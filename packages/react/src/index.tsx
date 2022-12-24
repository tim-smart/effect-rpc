import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Runtime from "@effect/io/Runtime"
import * as Scope from "@effect/io/Scope"
import React, { createContext, PropsWithChildren } from "react"
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

export const makeFromLayer = <R, E>(layer: Layer.Layer<never, E, R>) => {
  const scope = Effect.unsafeRunSync(Scope.make())
  return makeFromRuntime(Scope.use(Layer.toRuntime(layer))(scope))
}

export const makeFromRuntime = <R, E>(
  makeContext: Effect.Effect<never, E, Runtime.Runtime<R>>,
) => {
  const get = Effect.unsafeRunSync(Effect.memoize(makeContext))
  const RuntimeContext = createContext(get)

  const Providers = ({ children }: PropsWithChildren) => (
    <RuntimeContext.Provider value={get}>
      <EffectSuspenseProvider>{children}</EffectSuspenseProvider>
    </RuntimeContext.Provider>
  )

  return {
    Providers,
    SuspenseProvider: EffectSuspenseProvider,
    EnvContext: RuntimeContext,
    useEffectIo: makeUseEffectIo(RuntimeContext),
    useEffectRepeat: makeUseEffectRepeat(RuntimeContext),
    useEffectWithResult: makeUseEffectWithResult(RuntimeContext),
    useEffectSuspense: makeUseEffectSuspense(RuntimeContext),
    useInvalidateEffect,
  }
}

export const makeDefault = () =>
  makeFromRuntime(Effect.succeed(Runtime.defaultRuntime))
