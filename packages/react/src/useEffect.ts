import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Schedule from "@effect/io/Schedule"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"
import { useCallback, useEffect, useRef, useState } from "react"
import { RuntimeContext, useEffectRunner } from "./runtime.js"

export type EffectResult<E, A> =
  | { _tag: "Initial" }
  | { _tag: "Loading" }
  | { _tag: "HasResult"; value: Either.Either<E, A> }
  | { _tag: "LoadingWithResult"; value: Either.Either<E, A> }

export interface EffectResultHelper<E, A> {
  readonly isLoading: boolean
  readonly value: O.Option<A>
  readonly error: O.Option<E>
}

export const flattenResult = <E, A>(
  result: EffectResult<E, A>,
): EffectResultHelper<E, A> => ({
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

export const makeUseEffectWithResult =
  <R, EC>(ctxContext: RuntimeContext<R, EC>) =>
  <E, A>(effect: Effect.Effect<R, E, A>) => {
    const runner = useEffectRunner(ctxContext)
    const cancelRef = useRef<(() => void) | undefined>(undefined)
    const [result, setResult] = useState<EffectResult<E, A>>({
      _tag: "Initial",
    })

    useEffect(() => () => cancelRef.current?.(), [cancelRef])

    const run = useCallback(() => {
      if (cancelRef.current) {
        return
      }

      setResult(
        result._tag === "HasResult"
          ? { _tag: "LoadingWithResult", value: result.value }
          : { _tag: "Loading" },
      )

      const cancel = runner(Effect.either(effect), (exit) => {
        cancelRef.current = undefined

        if (Exit.isSuccess(exit)) {
          setResult({ _tag: "HasResult", value: exit.value })
        } else {
          throw Cause.squash(exit.cause)
        }
      })

      cancelRef.current = cancel
    }, [runner, effect, result])

    return { result, run }
  }

export interface EffectHelperWithRun<E, A> extends EffectResultHelper<E, A> {
  run: () => void
}

export const makeUseEffectIo = <R, EC>(ctx: RuntimeContext<R, EC>) => {
  const useEffectWithResult = makeUseEffectWithResult(ctx)
  return <E, A>(effect: Effect.Effect<R, E, A>): EffectHelperWithRun<E, A> => {
    const { result, run } = useEffectWithResult(effect)
    return { ...flattenResult(result), run }
  }
}

export interface UseEffectRepeatOpts<A> {
  schedule?: Schedule.Schedule<never, A, unknown>
}

export const makeUseEffectRepeat =
  <R, EC>(runtimeContext: RuntimeContext<R, EC>) =>
  <E, A>(
    effect: Effect.Effect<R, E, A>,
    { schedule = Schedule.forever() }: UseEffectRepeatOpts<A> = {},
  ) => {
    const runner = useEffectRunner(runtimeContext)
    const [result, setResult] = useState<EffectResult<E, A>>({
      _tag: "Loading",
    })

    useEffect(() => {
      const interrupt = runner(
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
          Effect.catchAll((e) =>
            Effect.sync(() => {
              setResult({
                _tag: "HasResult",
                value: Either.left(e),
              })
            }),
          ),
        ),
        (exit) => {
          if (Exit.isFailure(exit)) {
            throw Cause.squash(exit.cause)
          }
        },
      )

      return interrupt
    }, [effect, runner])

    return flattenResult(result)
  }
