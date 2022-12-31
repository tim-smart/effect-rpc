import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RuntimeContext, useEffectRunner } from "./runtime.js"

export type EffectResult<E, A> =
  | { _tag: "Initial" }
  | { _tag: "Loading" }
  | { _tag: "HasResult"; value: Either<E, A> }
  | { _tag: "LoadingWithResult"; value: Either<E, A> }

export interface EffectResultHelper<E, A> {
  readonly isLoading: boolean
  readonly value: Maybe<A>
  readonly error: Maybe<E>
}

export const flattenResult = <E, A>(
  result: EffectResult<E, A>,
): EffectResultHelper<E, A> => ({
  isLoading: result._tag === "Loading" || result._tag == "LoadingWithResult",
  value:
    (result._tag === "HasResult" || result._tag === "LoadingWithResult") &&
    result.value._tag === "Right"
      ? Maybe.some(result.value.right)
      : Maybe.none,
  error:
    (result._tag === "HasResult" || result._tag === "LoadingWithResult") &&
    result.value._tag === "Left"
      ? Maybe.some(result.value.left)
      : Maybe.none,
})

export const makeUseEffectWithResult =
  <R, EC>(ctxContext: RuntimeContext<R, EC>) =>
  <E, A>(effect: Effect<R, E, A>) => {
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

      const cancel = runner(effect.either, (exit) => {
        cancelRef.current = undefined

        if (exit.isSuccess()) {
          setResult({ _tag: "HasResult", value: exit.value })
        } else if (!exit.isInterrupted()) {
          console.error("useEffectWithResult", exit.cause.pretty())
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
  return <E, A>(effect: Effect<R, E, A>): EffectHelperWithRun<E, A> => {
    const { result, run } = useEffectWithResult(effect)
    return { ...flattenResult(result), run }
  }
}

export const makeUseEffectScoped = <R, EC>(ctx: RuntimeContext<R, EC>) => {
  const useEffectWithResult = makeUseEffectWithResult(ctx)
  return <E, A>(effect: Effect<R | Scope, E, A>): EffectHelperWithRun<E, A> => {
    const scope = useMemo(() => Scope.make().unsafeRunSync, [])
    useEffect(() => () => scope.close(Exit.unit()).unsafeRunAsync, [scope])

    const scopedEffect = useMemo(() => scope.use(effect), [effect, scope])
    const { result, run } = useEffectWithResult(scopedEffect)
    return { ...flattenResult(result), run }
  }
}

export interface UseEffectRepeatOpts<A> {
  schedule?: Schedule<never, A, unknown>
}

export const makeUseEffectRepeat =
  <R, EC>(runtimeContext: RuntimeContext<R, EC>) =>
  <E, A>(
    effect: Effect<R, E, A>,
    { schedule = Schedule.forever() }: UseEffectRepeatOpts<A> = {},
  ) => {
    const runner = useEffectRunner(runtimeContext)
    const [result, setResult] = useState<EffectResult<E, A>>({
      _tag: "Loading",
    })

    useEffect(() => {
      const interrupt = runner(
        effect
          .tap((value) =>
            Effect.sync(() => {
              setResult({
                _tag: "LoadingWithResult",
                value: Either.right(value),
              })
            }),
          )
          .repeat(schedule)
          .catchAll((e) =>
            Effect.sync(() => {
              setResult({
                _tag: "HasResult",
                value: Either.left(e),
              })
            }),
          ),
        (exit) => {
          if (exit.isFailure() && !exit.isInterrupted()) {
            console.error("useEffectRepeat", exit.cause.pretty())
          }
        },
      )

      return interrupt
    }, [effect, runner])

    return flattenResult(result)
  }
