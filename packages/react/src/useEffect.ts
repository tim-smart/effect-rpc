import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as FiberId from "@effect/io/Fiber/Id"
import * as Runtime from "@effect/io/Runtime"
import * as Schedule from "@effect/io/Schedule"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"
import {
  Context,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type EffectResult<A> =
  | { _tag: "Initial" }
  | { _tag: "Loading" }
  | { _tag: "HasResult"; value: A }
  | { _tag: "LoadingWithResult"; value: A }

const flatten = <A>(
  result: EffectResult<A>,
): Readonly<{
  isLoading: boolean
  value: O.Option<A>
}> => ({
  isLoading: result._tag === "Loading" || result._tag == "LoadingWithResult",
  value:
    result._tag === "HasResult" || result._tag === "LoadingWithResult"
      ? O.some(result.value)
      : O.none,
})

export interface UseEffectOpts<R> {
  runtime: Context<Runtime.Runtime<R>>
  deps?: any[]
}

export const useEffectWithResult = <R, A>(
  f: () => Effect.Effect<R, never, A>,
  { runtime, deps = [] }: UseEffectOpts<R>,
) => {
  const rt = useContext(runtime)
  const effect = useMemo(f, deps)
  const [cancel, setCancel] = useState(() => () => {})
  const [result, setResult] = useState<EffectResult<A>>({ _tag: "Initial" })

  useEffect(() => cancel, [cancel])

  const run = useCallback(() => {
    if (result._tag === "Loading" || result._tag === "LoadingWithResult") {
      return
    }

    setResult(
      result._tag === "HasResult"
        ? { _tag: "LoadingWithResult", value: result.value }
        : { _tag: "Loading" },
    )

    const interrupt = rt.unsafeRunWith(effect, (exit) => {
      if (Exit.isSuccess(exit)) {
        setResult({ _tag: "HasResult", value: exit.value })
      } else {
        throw Cause.squash(exit.cause)
      }
    })

    setCancel(() => interrupt(FiberId.none)(() => {}))
  }, [rt, effect])

  return { result, run }
}

export const useEffectIo = <R, A>(
  f: () => Effect.Effect<R, never, A>,
  opts: UseEffectOpts<R>,
) => {
  const { result, run } = useEffectWithResult(f, opts)
  return { ...flatten(result), run }
}

export const useEffectRepeat = <R, E, A>(
  f: () => Effect.Effect<R, E, A>,
  {
    runtime,
    schedule = Schedule.forever(),
    deps = [],
  }: UseEffectOpts<R> & {
    schedule?: Schedule.Schedule<never, A, unknown>
  },
) => {
  const rt = useContext(runtime)
  const effect = useMemo(f, deps)
  const [result, setResult] = useState<EffectResult<A>>({ _tag: "Loading" })

  useEffect(() => {
    const interrupt = rt.unsafeRunWith(
      pipe(
        effect,
        Effect.tap((value) =>
          Effect.sync(() => {
            setResult({
              _tag: "LoadingWithResult",
              value,
            })
          }),
        ),
        Effect.repeat(schedule),
      ),
      () => {},
    )

    return () => interrupt(FiberId.none)(() => {})
  }, [effect, rt])

  return flatten(result)
}
