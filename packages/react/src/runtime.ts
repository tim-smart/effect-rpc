import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Runtime from "@effect/io/Runtime"
import { Context, useCallback, useContext } from "react"

export type RuntimeContext<R, E> = Context<
  Effect.Effect<never, E, Runtime.Runtime<R>>
>

const useWrapEffect = <R, EC>(context: RuntimeContext<R, EC>) => {
  const runtime = useContext(context)

  return useCallback(
    <E, A>(effect: Effect.Effect<R, E, A>) =>
      runtime.flatMap((rt) =>
        Effect.asyncInterrupt<never, E, A>((resume) => {
          const interrupt = rt.unsafeRun(effect, (exit) => {
            if (Exit.isSuccess(exit)) {
              resume(Effect.succeed(exit.value))
            } else {
              resume(Effect.failCause(exit.cause))
            }
          })

          return Effect.sync(() => {
            interrupt()
          })
        }),
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
      const interrupt = Effect.unsafeRun(wrap(effect), onExit)
      return () => interrupt()
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
