import * as SR from "@effect/stream/SubscriptionRef"
import { useEffect, useState } from "react"

export const useSubscriptionRef = <E, A>(ref: SR.SubscriptionRef<A>) => {
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
