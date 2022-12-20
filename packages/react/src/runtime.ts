import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as FiberId from "@effect/io/Fiber/Id"
import * as Runtime from "@effect/io/Runtime"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import { Context, useCallback, useContext } from "react"

export type RuntimeContext<R> = Context<
  Effect.Effect<never, never, Runtime.Runtime<R>>
>

const useWrapEffect = <R>(context: RuntimeContext<R>) => {
  const runtime = useContext(context)

  return useCallback(
    <E, A>(effect: Effect.Effect<R, E, A>) =>
      pipe(
        runtime,
        Effect.flatMap((rt) =>
          Effect.asyncInterrupt<never, E, A>((resume) => {
            const interrupt = rt.unsafeRunWith(effect, (exit) => {
              if (Exit.isSuccess(exit)) {
                resume(Effect.succeed(exit.value))
              } else {
                resume(Effect.failCause(exit.cause))
              }
            })

            return Either.left(
              pipe(
                Effect.fiberId(),
                Effect.tap((id) =>
                  Effect.sync(() => {
                    interrupt(id)(() => {})
                  }),
                ),
              ),
            )
          }),
        ),
      ),
    [runtime],
  )
}

export const useEffectRunner = <R>(context: RuntimeContext<R>) => {
  const wrap = useWrapEffect(context)

  return useCallback(
    <E, A>(
      effect: Effect.Effect<R, E, A>,
      onExit: (exit: Exit.Exit<E, A>) => void,
    ) => {
      const wrapped = wrap(effect)
      const interrupt = Effect.unsafeRunWith(wrapped, onExit)
      return () => interrupt(FiberId.none)(() => {})
    },
    [wrap],
  )
}

export const useEffectRunnerPromise = <R>(context: RuntimeContext<R>) => {
  const wrap = useWrapEffect(context)

  return useCallback(
    <E, A>(effect: Effect.Effect<R, E, A>) =>
      Effect.unsafeRunPromise(wrap(effect)),
    [wrap],
  )
}
