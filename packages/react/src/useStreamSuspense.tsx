import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Scope from "@effect/io/Scope"
import * as Stream from "@effect/stream/Stream"
import * as SR from "@effect/stream/SubscriptionRef"
import * as Chunk from "@fp-ts/data/Chunk"
import * as E from "@fp-ts/data/Either"
import * as These from "@fp-ts/data/These"
import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useMemo,
} from "react"
import { RuntimeContext, useEffectRunnerPromise } from "./runtime.js"
import { useSubscriptionRef } from "./useSubscriptionRef.js"

export interface Cache {
  registry: FinalizationRegistry<Scope.CloseableScope>
  entries: WeakMap<Stream.Stream<any, any, any>, CacheEntry<any, any>>
}

export type CacheEntry<E, A> = E.Either<
  Promise<void>,
  {
    pull: () => Promise<void>
    ref: StreamRef<E, A>
  }
>

export type StreamRef<E, A> = SR.SubscriptionRef<{
  readonly pulling: boolean
  readonly complete: boolean
  readonly value: These.These<E, A>
}>

export class EmptyStreamError {
  readonly _tag = "EmptyStreamError"
}

const makeCache = (): Cache => ({
  registry: new FinalizationRegistry((scope) => {
    Effect.unsafeRunAsync(Scope.close(Exit.unit())(scope))
  }),
  entries: new WeakMap(),
})

export const StreamSuspenseContext = createContext(makeCache())
export const StreamSuspenseProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo(() => makeCache(), [])
  return (
    <StreamSuspenseContext.Provider value={value}>
      {children}
    </StreamSuspenseContext.Provider>
  )
}

const streamToPull = <R, E, A>(stream: Stream.Stream<R, E, A>) =>
  Do(($) => {
    const pullChunk = $(stream.rechunk(1).toPull)
    const pull = pullChunk.map(Chunk.unsafeHead)
    const first = $(
      pull
        .catchTag("None", () => Effect.fail(new EmptyStreamError()))
        .mapError((e) => (e._tag === "Some" ? e.value : e)),
    )

    const ref: StreamRef<E, A> = $(
      SR.make({
        pulling: false,
        complete: false,
        value: These.right(first),
      }),
    )

    const pullAndUpdate = ref
      .update((a) => ({
        ...a,
        pulling: true,
      }))
      .flatMap(() => pull)
      .tap((a) =>
        ref.update((current) => ({
          ...current,
          pulling: false,
          value: current.value.map(() => a),
        })),
      )
      .catchTag("None", () =>
        ref.update((current) => ({
          ...current,
          pulling: false,
          complete: true,
        })),
      )
      .catchAll((e) =>
        ref.update((current) => ({
          pulling: false,
          complete: true,
          value: current.value.match(
            () => These.left(e.value),
            (a) => These.both(e.value, a),
            (_, a) => These.both(e.value, a),
          ),
        })),
      ).asUnit
    return [ref, pullAndUpdate] as const
  })

export const makeUseStreamSuspense =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <E, A>(stream: Stream.Stream<R, E, A>) => {
    const runner = useEffectRunnerPromise(runtime)
    const { entries, registry } = useContext(StreamSuspenseContext)
    const entry = entries.get(stream) as CacheEntry<E, A>

    if (!entry) {
      const scope = Scope.make().unsafeRunSync
      registry.register(stream, scope)

      const effect = streamToPull(stream).tap(([ref, pull]) =>
        Effect.sync(() => {
          entries.set(
            stream,
            E.right({
              pull: () => runner(pull),
              ref,
            }),
          )
        }),
      ).asUnit

      const promise = runner(scope.use(effect))
      entries.set(stream, E.left(promise))
      throw promise
    } else if (entry._tag === "Left") {
      throw entry.left
    }

    const { pulling, complete, value } = useSubscriptionRef(entry.right.ref)
    const pull = entry.right.pull

    return {
      pull,
      pulling,
      complete,
      error: value.getLeft,
      value: value.getRight,
    }
  }
