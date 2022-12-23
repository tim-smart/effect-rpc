import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as FiberId from "@effect/io/Fiber/Id"
import * as Runtime from "@effect/io/Runtime"
import { pipe } from "@fp-ts/data/Function"
import { Context, useCallback, useContext } from "react"

export type RuntimeContext<R, E> = Context<
  Effect.Effect<never, E, Runtime.Runtime<R>>
>

const useWrapEffect = <R, EC>(context: RuntimeContext<R, EC>) => {
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

            return Effect.sync(() => {
              interrupt(FiberId.none)(() => {})
            })
          }),
        ),
      ),
    [runtime],
  )
}

export const useEffectRunner = <R, EC>(context: RuntimeContext<R, EC>) => {
  const wrap = useWrapEffect(context)

  return useCallback(
    <E, A>(
      effect: Effect.Effect<R, E, A>,
      onExit: (exit: Exit.Exit<E | EC, A>) => void,
    ) => {
      const interrupt = Effect.unsafeRunWith(wrap(effect), onExit)
      return () => interrupt(FiberId.none)(() => {})
    },
    [wrap],
  )
}

export const useEffectRunnerPromise = <R, EC>(
  context: RuntimeContext<R, EC>,
) => {
  const wrap = useWrapEffect(context)

  return useCallback(
    <E, A>(effect: Effect.Effect<R, E, A>) =>
      Effect.unsafeRunPromise(wrap(effect)),
    [wrap],
  )
}
