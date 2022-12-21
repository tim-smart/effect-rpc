import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as FiberId from "@effect/io/Fiber/Id"
import * as Hub from "@effect/io/Hub"
import { Dequeue } from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Scope from "@effect/io/Scope"
import { pipe } from "@fp-ts/data/Function"
import { useEffect, useMemo, useState } from "react"

export interface HubRef<A> {
  get: Effect.Effect<never, never, A>
  set: (a: A) => Effect.Effect<never, never, void>
  update: (f: (a: A) => A) => Effect.Effect<never, never, void>
  subscribe: Effect.Effect<Scope.Scope, never, Dequeue<A>>
}

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

      const subscribe = Hub.subscribe(hub)

      return {
        get,
        set,
        update,
        subscribe,
      }
    }),
  )

export const useHubRef = <A>(ref: HubRef<A>) => {
  // Current value
  const [value, setValue] = useState(() => Effect.unsafeRunSync(ref.get))

  // Scope
  const scope = useMemo(() => Effect.unsafeRunSync(Scope.make()), [])
  useEffect(
    () => () => {
      Effect.unsafeRunAsync(Scope.close(Exit.unit())(scope))
    },
    [scope],
  )

  // Run
  useEffect(() => {
    const effect = pipe(
      Scope.use(ref.subscribe)(scope),
      Effect.flatMap((q) =>
        pipe(
          q.take(),
          Effect.tap((a) =>
            Effect.sync(() => {
              setValue(a)
            }),
          ),
          Effect.forever,
        ),
      ),
    )

    const interrupt = Effect.unsafeRunWith(effect, () => {})

    return () => interrupt(FiberId.none)(() => {})
  }, [scope])

  return value
}
