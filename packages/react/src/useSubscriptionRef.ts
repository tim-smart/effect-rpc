import { useEffect, useState } from "react"
import { RuntimeContext, useEffectRunner } from "./runtime.js"
import { makeUseEffectSuspense } from "./useEffectSuspense.js"

export const makeUseSubscriptionRef =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <A>(ref: SubscriptionRef<A>) => {
    const runner = useEffectRunner(runtime)
    const [value, setValue] = useState(() => ref.get.unsafeRunSync)

    useEffect(() => {
      const effect = ref.changes.tap((a) =>
        Effect.sync(() => {
          setValue(a)
        }),
      ).runDrain

      return runner(effect, (exit) => {
        if (exit.isFailure() && !exit.isInterrupted()) {
          console.error("useSubscriptionRef", exit.cause.pretty())
        }
      })
    }, [ref])

    return value
  }

export const makeUseSubscriptionRefEffect = <R, EC>(
  runtime: RuntimeContext<R, EC>,
) => {
  const useEffectSuspense = makeUseEffectSuspense(runtime)
  const useSubscriptionRef = makeUseSubscriptionRef(runtime)
  return <E, A>(refEffect: Effect<R, E, SubscriptionRef<A>>) => {
    const ref = useEffectSuspense(refEffect)
    return useSubscriptionRef(ref)
  }
}
