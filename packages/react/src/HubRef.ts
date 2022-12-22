import * as Effect from "@effect/io/Effect"
import * as Hub from "@effect/io/Hub"
import * as Ref from "@effect/io/Ref"
import * as Scope from "@effect/io/Scope"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import { useEffect, useState } from "react"
import { RuntimeContext, useEffectRunner } from "./runtime.js"
import { EffectResult, flattenResult } from "./useEffect.js"

/**
 * @tsplus type effect-rpc/react/HubRef.ReadOnly
 */
export interface ReadOnlyHubRef<R, E, A> {
  get: Effect.Effect<R, E, A>
  subscribe: Effect.Effect<Scope.Scope, never, Effect.Effect<R, E, A>>
}

/**
 * @tsplus type effect-rpc/react/HubRef
 */
export interface HubRef<A> extends ReadOnlyHubRef<never, never, A> {
  set: (a: A) => Effect.Effect<never, never, void>
  update: (f: (a: A) => A) => Effect.Effect<never, never, void>
}

/**
 * @tsplus static effect-rpc/react/HubRef make
 */
export const make = <A>(
  initialValue: A,
): Effect.Effect<never, never, HubRef<A>> =>
  pipe(
    Effect.struct({
      ref: Ref.make(initialValue),
      hub: Hub.unbounded<A>(),
    }),
    Effect.map(({ ref, hub }) => {
      const get = Ref.get(ref)

      const set = (a: A) =>
        Effect.collectAllParDiscard([
          pipe(ref, Ref.set(a)),
          pipe(hub, Hub.publish(a)),
        ])

      const update = (f: (a: A) => A) =>
        pipe(
          get,
          Effect.flatMap((a) => set(f(a))),
        )

      const subscribe = pipe(
        Hub.subscribe(hub),
        Effect.map((q) => pipe(q.take())),
      )

      return {
        get,
        set,
        update,
        subscribe,
      }
    }),
  )

/**
 * @tsplus pipeable effect-rpc/react/HubRef.ReadOnly mapEffect
 */
export const mapEffect =
  <R, E, A, B>(f: (a: A) => Effect.Effect<R, E, B>) =>
  <R1, E1>(
    self: ReadOnlyHubRef<R1, E1, A>,
  ): ReadOnlyHubRef<R | R1, E | E1, B> => {
    const get = pipe(self.get, Effect.flatMap(f))

    const subscribe = pipe(
      self.subscribe,
      Effect.map((take) => pipe(take, Effect.flatMap(f))),
    )

    return { get, subscribe }
  }

/**
 * @tsplus pipeable effect-rpc/react/HubRef.ReadOnly map
 */
export const map = <A, B>(f: (a: A) => B) =>
  mapEffect((a: A) => Effect.succeed(f(a)))

/**
 * @tsplus getter effect-rpc/react/HubRef use
 */
export const makeUseHubRef =
  <R>(runtimeContext: RuntimeContext<R>) =>
  <E, A>(ref: ReadOnlyHubRef<R, E, A>) => {
    const runner = useEffectRunner(runtimeContext)

    // Current value
    const [value, setValue] = useState<EffectResult<E, A>>({ _tag: "Initial" })

    // Run
    useEffect(() => {
      const getEffect = pipe(
        ref.get,
        Effect.flatMap((a) =>
          Effect.sync(() => {
            setValue({ _tag: "LoadingWithResult", value: Either.right(a) })
          }),
        ),
        Effect.catchAll((e) =>
          Effect.sync(() => {
            setValue({ _tag: "LoadingWithResult", value: Either.left(e) })
          }),
        ),
      )

      const subscribe = pipe(
        ref.subscribe,
        Effect.flatMap((take) =>
          pipe(
            take,
            Effect.tap((a) =>
              Effect.sync(() => {
                setValue({ _tag: "LoadingWithResult", value: Either.right(a) })
              }),
            ),
            Effect.catchAll((e) =>
              Effect.sync(() => {
                setValue({ _tag: "LoadingWithResult", value: Either.left(e) })
              }),
            ),
            Effect.forever,
          ),
        ),
        Effect.scoped,
      )

      const effect = pipe(
        getEffect,
        Effect.flatMap(() => subscribe),
      )

      return runner(effect, () => {})
    }, [runner])

    return flattenResult(value)
  }
