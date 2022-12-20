import * as Effect from "@effect/io/Effect"
import * as Scope from "@effect/io/Scope"
import * as Layer from "@effect/io/Layer"
import * as Runtime from "@effect/io/Runtime"
import { pipe } from "@fp-ts/data/Function"
import {
  makeUseEffectWithResult,
  makeUseEffectIo,
  makeUseEffectRepeat,
} from "./useEffect.js"
import {
  makeUseEffectSuspense,
  useInvalidateEffect,
  EffectSuspenseProvider,
} from "./useEffectSuspense.js"
import React, { createContext, PropsWithChildren } from "react"

export const makeHooks = <R,>(layer: Layer.Layer<never, never, R>) => {
  const scope = Effect.unsafeRunSync(Scope.make())
  const runtime = pipe(layer, Layer.toRuntime)
  const scopedRuntime = Scope.use(runtime)(scope)

  return makeFromRuntime(scopedRuntime)
}

const makeFromRuntime = <R,>(
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
  }
}

export const makeHooksDefault = () =>
  makeFromRuntime(Effect.succeed(Runtime.defaultRuntime))
