import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RuntimeContext, useEffectRunner } from "./runtime.js"
import { makeUseSubscriptionRef } from "./useSubscriptionRef.js"

export type StreamResult<E, A> =
  | { _tag: "Initial" }
  | { _tag: "Pulling" }
  | { _tag: "HasResult"; value: A }
  | { _tag: "PullingWithResult"; value: A }
  | { _tag: "CompleteWithoutResult" }
  | { _tag: "CompleteWithResult"; value: A }
  | { _tag: "CompleteWithError"; error: E }

export const flatten = <E, A>(
  a: StreamResult<E, A>,
): {
  readonly pulling: boolean
  readonly complete: boolean
  readonly value: Maybe<A>
  readonly error: Maybe<E>
} => ({
  pulling: a._tag.startsWith("Pulling"),
  complete: a._tag.startsWith("Complete"),
  value: "value" in a ? Maybe.some(a.value) : Maybe.none,
  error: a._tag === "CompleteWithError" ? Maybe.some(a.error) : Maybe.none,
})

export const makeUseStream =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <E, A>(stream: Stream<R, E, A>, initialPull = true) => {
    const runner = useEffectRunner(runtime)

    const scope = useMemo(() => Scope.make().unsafeRunSync, [])
    useEffect(
      () => () => {
        scope.close(Exit.unit()).unsafeRun()
      },
      [scope],
    )

    const [value, setValue] = useState<StreamResult<E, A>>({ _tag: "Initial" })
    const pullRef = useRef<Effect<R, Maybe<E>, A> | undefined>(undefined)

    const cancelRef = useRef<(() => void) | undefined>(undefined)
    useEffect(() => () => cancelRef.current?.(), [cancelRef])

    const pull = useCallback(() => {
      if (
        value._tag.startsWith("Pulling") ||
        value._tag.startsWith("Complete")
      ) {
        return
      }

      setValue(
        value._tag === "Initial"
          ? {
              _tag: "Pulling",
            }
          : {
              _tag: "PullingWithResult",
              value: (value as any).value,
            },
      )

      const setup = Do(($) => {
        const pullChunk = $(scope.use(stream.rechunk(1).toPull))
        const pull = pullChunk.map((c) => c.unsafeHead)
        pullRef.current = pull
        return $(pull)
      })

      const run = Do(($) => {
        const value = $(pullRef.current ?? setup)
        setValue({
          _tag: "HasResult",
          value,
        })
      })
        .catchTag("None", () =>
          Effect.sync(() => {
            setValue(
              value._tag === "Pulling"
                ? {
                    _tag: "CompleteWithoutResult",
                  }
                : {
                    _tag: "CompleteWithResult",
                    value: (value as any).value,
                  },
            )
          }),
        )
        .catchAll((e) =>
          Effect.sync(() => {
            setValue({
              _tag: "CompleteWithError",
              error: e.value,
            })
          }),
        )

      cancelRef.current = runner(run, (exit) => {
        cancelRef.current = undefined
        if (exit.isFailure() && !exit.isInterrupted()) {
          console.error("useStream", exit.cause.pretty())
        }
      })
    }, [stream, runner, scope, value, pullRef])

    useEffect(() => {
      if (initialPull) {
        pull()
      }
    }, [])

    return { ...flatten(value), pull }
  }

export const makeUseStreamLatest = <R, EC>(runtime: RuntimeContext<R, EC>) => {
  const useSubscriptionRef = makeUseSubscriptionRef(runtime)

  return <E, A>(stream: Stream<R, E, A>) => {
    const runner = useEffectRunner(runtime)
    const ref = useMemo(
      () =>
        SubscriptionRef.make<StreamResult<E, A>>({ _tag: "Pulling" })
          .unsafeRunSync,
      [],
    )

    useEffect(
      () =>
        runner(
          stream
            .tap((value) => ref.set({ _tag: "PullingWithResult", value }))
            .runDrain.tap(() =>
              ref.update(
                (a): StreamResult<E, A> =>
                  a._tag === "PullingWithResult"
                    ? {
                        _tag: "CompleteWithResult",
                        value: a.value,
                      }
                    : { _tag: "CompleteWithoutResult" },
              ),
            )
            .catchAll((error) =>
              ref.set({
                _tag: "CompleteWithError",
                error,
              }),
            ),
          (exit) => {
            if (exit.isFailure() && !exit.isInterrupted()) {
              console.error("useStreamLatest", exit.cause.pretty())
            }
          },
        ),
      [runner, stream, ref],
    )

    return flatten(useSubscriptionRef(ref))
  }
}
