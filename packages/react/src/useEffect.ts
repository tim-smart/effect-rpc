import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as FiberId from "@effect/io/Fiber/Id"
import * as Runtime from "@effect/io/Runtime"
import * as Schedule from "@effect/io/Schedule"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"
import * as Either from "@fp-ts/data/Either"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type EffectResult<E, A> =
  | { _tag: "Initial" }
  | { _tag: "Loading" }
  | { _tag: "HasResult"; value: Either.Either<E, A> }
  | { _tag: "LoadingWithResult"; value: Either.Either<E, A> }

const flatten = <E, A>(
  result: EffectResult<E, A>,
): Readonly<{
  isLoading: boolean
  value: O.Option<A>
  error: O.Option<E>
}> => ({
  isLoading: result._tag === "Loading" || result._tag == "LoadingWithResult",
  value:
    (result._tag === "HasResult" || result._tag === "LoadingWithResult") &&
    result.value._tag === "Right"
      ? O.some(result.value.right)
      : O.none,
  error:
    (result._tag === "HasResult" || result._tag === "LoadingWithResult") &&
    result.value._tag === "Left"
      ? O.some(result.value.left)
      : O.none,
})

export interface UseEffectOpts<R> {
  runtime?: Runtime.Runtime<R>
  deps?: any[]
}

export const useEffectWithResult = <R, E, A>(
  f: () => Effect.Effect<R, E, A>,
  {
    runtime = Runtime.defaultRuntime as Runtime.Runtime<R>,
    deps = [],
  }: UseEffectOpts<R> = {},
) => {
  const effect = useMemo(f, deps)
  const cancelRef = useRef<(() => void) | undefined>(undefined)
  const [result, setResult] = useState<EffectResult<E, A>>({ _tag: "Initial" })

  useEffect(() => cancelRef.current?.(), [cancelRef])

  const run = useCallback(() => {
    if (cancelRef.current) {
      return
    }

    setResult(
      result._tag === "HasResult"
        ? { _tag: "LoadingWithResult", value: result.value }
        : { _tag: "Loading" },
    )

    const interrupt = runtime.unsafeRunWith(Effect.either(effect), (exit) => {
      cancelRef.current = undefined

      if (Exit.isSuccess(exit)) {
        setResult({ _tag: "HasResult", value: exit.value })
      } else {
        throw Cause.squash(exit.cause)
      }
    })

    cancelRef.current = () => interrupt(FiberId.none)(() => {})
  }, [runtime, effect, result])

  return { result, run }
}

export const useEffectIo = <R, E, A>(
  f: () => Effect.Effect<R, E, A>,
  opts: UseEffectOpts<R> = {},
) => {
  const { result, run } = useEffectWithResult(f, opts)
  return { ...flatten(result), run }
}

export const useEffectRepeat = <R, E, A>(
  f: () => Effect.Effect<R, E, A>,
  {
    runtime = Runtime.defaultRuntime as Runtime.Runtime<R>,
    schedule = Schedule.forever(),
    deps = [],
  }: UseEffectOpts<R> & {
    schedule?: Schedule.Schedule<never, A, unknown>
  },
) => {
  const effect = useMemo(f, deps)
  const [result, setResult] = useState<EffectResult<E, A>>({ _tag: "Loading" })

  useEffect(() => {
    const interrupt = runtime.unsafeRunWith(
      pipe(
        effect,
        Effect.tap((value) =>
          Effect.sync(() => {
            setResult({
              _tag: "LoadingWithResult",
              value: Either.right(value),
            })
          }),
        ),
        Effect.repeat(schedule),
      ),
      () => {},
    )

    return () => interrupt(FiberId.none)(() => {})
  }, [effect, runtime])

  return flatten(result)
}
