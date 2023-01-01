import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useMemo,
} from "react"
import { RuntimeContext, useEffectRunnerPromise } from "./runtime.js"
import { useSubscriptionRef } from "./useSubscriptionRef.js"

export interface Cache {
  registry: FinalizationRegistry<CloseableScope>
  entries: WeakMap<Stream<any, any, any>, CacheEntry<any, any>>
}

export type CacheEntry<E, A> = Either<
  Promise<void>,
  {
    pull: () => Promise<void>
    ref: StreamRef<E, A>
  }
>

export type StreamRef<E, A> = SubscriptionRef<{
  readonly pulling: boolean
  readonly value: These<Maybe<E>, A>
}>

export class EmptyStreamError {
  readonly _tag = "EmptyStreamError"
}

const makeCache = (): Cache => ({
  registry: new FinalizationRegistry((scope) => {
    scope.close(Exit.unit()).unsafeRunAsync
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

const streamToPull = <R, E, A>(stream: Stream<R, E, A>) =>
  Do(($) => {
    const pullChunk = $(stream.rechunk(1).toPull)
    const pull = pullChunk.map((c) => c.unsafeHead)
    const first = $(
      pull
        .catchTag("None", () => Effect.fail(new EmptyStreamError()))
        .mapError((e) => (e._tag === "Some" ? e.value : e)),
    )

    const ref: StreamRef<E, A> = $(
      SubscriptionRef.make({
        pulling: false,
        complete: false,
        value: These.right(first),
      }),
    )

    const pullAndUpdate = Do(($) => {
      const current = $(ref.get)
      if (current.pulling) return

      $(
        ref.set({
          ...current,
          pulling: true,
        }),
      )

      const a = $(pull)

      $(
        ref.set({
          pulling: false,
          value: current.value.map(() => a),
        }),
      )
    }).catchAll((e) =>
      ref.update((current) => ({
        pulling: false,
        value: current.value.match(
          () => These.left(e),
          (a) => These.both(e, a),
          (_, a) => These.both(e, a),
        ),
      })),
    )

    return [ref, pullAndUpdate] as const
  })

export const makeUseStreamSuspense =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <E, A>(stream: Stream<R, E, A>) => {
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
            Either.right({
              pull: () => runner(pull),
              ref,
            }),
          )
        }),
      ).asUnit

      const promise = runner(scope.use(effect))
      entries.set(stream, Either.left(promise))
      throw promise
    } else if (entry._tag === "Left") {
      throw entry.left
    }

    const { pulling, value } = useSubscriptionRef(entry.right.ref)
    const pull = entry.right.pull

    return {
      pull,
      pulling,
      complete: value.isBoth() && value.left._tag === "None",
      error: value.getLeft.flatten,
      value: value.getOrThrow(() => "left"),
    }
  }
