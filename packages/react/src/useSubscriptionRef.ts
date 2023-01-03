import * as SR from "@effect/stream/SubscriptionRef"
import { useEffect, useState } from "react"
import { RuntimeContext } from "./runtime.js"
import { makeUseEffectSuspense } from "./useEffectSuspense.js"

export const useSubscriptionRef = <A>(ref: SR.SubscriptionRef<A>) => {
  const [value, setValue] = useState(() => ref.get.unsafeRunSync)

  useEffect(() => {
    const interrupt = ref.changes
      .tap((a) =>
        Effect.sync(() => {
          setValue(a)
        }),
      )
      .runDrain.unsafeRun((exit) => {
        if (exit.isFailure() && !exit.isInterrupted()) {
          console.error("useSubscriptionRef", exit.cause.pretty())
        }
      })

    return () => interrupt()
  }, [ref])

  return value
}

export const makeUseSubscriptionRefEffect = <R, EC>(
  runtime: RuntimeContext<R, EC>,
) => {
  const useEffectSuspense = makeUseEffectSuspense(runtime)
  return <E, A>(refEffect: Effect<R, E, SR.SubscriptionRef<A>>) => {
    const ref = useEffectSuspense(refEffect)
    return useSubscriptionRef(ref)
  }
}
