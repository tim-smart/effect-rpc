import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Runtime from "@effect/io/Runtime"
import * as Scope from "@effect/io/Scope"
import { pipe } from "@fp-ts/data/Function"
import React, { createContext, PropsWithChildren } from "react"
import { makeUseHubRef } from "./HubRef.js"
import {
  makeUseEffectIo,
  makeUseEffectRepeat,
  makeUseEffectWithResult,
} from "./useEffect.js"
import {
  EffectSuspenseProvider,
  makeUseEffectSuspense,
  useInvalidateEffect,
} from "./useEffectSuspense.js"

export * as HubRef from "./HubRef.js"

export const makeFromLayer = <R,>(layer: Layer.Layer<never, never, R>) => {
  const scope = Effect.unsafeRunSync(Scope.make())
  const runtime = pipe(layer, Layer.toRuntime)
  const scopedRuntime = Scope.use(runtime)(scope)

  return makeFromRuntime(scopedRuntime)
}

export const makeFromRuntime = <R,>(
  runtime: Effect.Effect<never, never, Runtime.Runtime<R>>,
) => {
  const RuntimeContext = createContext(runtime)

  const Providers = ({ children }: PropsWithChildren) => (
    <RuntimeContext.Provider value={runtime}>
      <EffectSuspenseProvider>{children}</EffectSuspenseProvider>
    </RuntimeContext.Provider>
  )

  return {
    Providers,
    SuspenseProvider: EffectSuspenseProvider,
    RuntimeContext,
    useEffectIo: makeUseEffectIo(RuntimeContext),
    useEffectRepeat: makeUseEffectRepeat(RuntimeContext),
    useEffectWithResult: makeUseEffectWithResult(RuntimeContext),
    useEffectSuspense: makeUseEffectSuspense(RuntimeContext),
    useInvalidateEffect,
    useHubRef: makeUseHubRef(RuntimeContext),
  }
}

export const makeDefault = () =>
  makeFromRuntime(Effect.succeed(Runtime.defaultRuntime))
