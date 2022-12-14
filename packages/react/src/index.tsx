import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Runtime from "@effect/io/Runtime"
import * as Scope from "@effect/io/Scope"
import React, { PropsWithChildren, createContext } from "react"
import {
  makeUseEffectIo,
  makeUseEffectRepeat,
  makeUseEffectScoped,
  makeUseEffectWithResult,
} from "./useEffect.js"
import {
  EffectSuspenseProvider,
  makeUseEffectSuspense,
  useInvalidateEffect,
} from "./useEffectSuspense.js"
import {
  StreamSuspenseProvider,
  makeUseStreamSuspense,
} from "./useStreamSuspense.js"
import {
  makeUseSubscriptionRefEffect,
  makeUseSubscriptionRef,
} from "./useSubscriptionRef.js"
import { makeUseStream, makeUseStreamLatest } from "./useStream.js"

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
      <EffectSuspenseProvider>
        <StreamSuspenseProvider>{children}</StreamSuspenseProvider>
      </EffectSuspenseProvider>
    </RuntimeContext.Provider>
  )

  return {
    Providers,
    SuspenseProvider: EffectSuspenseProvider,
    StreamSuspenseProvider,
    RuntimeContext,
    useEffectIo: makeUseEffectIo(RuntimeContext),
    useEffectScoped: makeUseEffectScoped(RuntimeContext),
    useEffectRepeat: makeUseEffectRepeat(RuntimeContext),
    useEffectWithResult: makeUseEffectWithResult(RuntimeContext),
    useEffectSuspense: makeUseEffectSuspense(RuntimeContext),
    useInvalidateEffect,
    useSubscriptionRef: makeUseSubscriptionRef(RuntimeContext),
    useSubscriptionRefEffect: makeUseSubscriptionRefEffect(RuntimeContext),
    useStreamSuspense: makeUseStreamSuspense(RuntimeContext),
    useStream: makeUseStream(RuntimeContext),
    useStreamLatest: makeUseStreamLatest(RuntimeContext),
  }
}

export const makeDefault = () =>
  makeFromRuntime(Effect.succeed(Runtime.defaultRuntime))
