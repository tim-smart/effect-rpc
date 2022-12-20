import * as Effect from "@effect/io/Effect"
import * as E from "@fp-ts/data/Either"
import React, { createContext, PropsWithChildren, useContext } from "react"
import { RuntimeContext, useEffectRunnerPromise } from "./runtime.js"

type CacheEntry<E, A> = E.Either<Promise<void>, E.Either<E, A>>

const CacheContext = createContext<
  WeakMap<Effect.Effect<any, any, any>, CacheEntry<unknown, unknown>>
>(new WeakMap())

export const EffectSuspenseProvider = ({ children }: PropsWithChildren) => {
  return (
    <CacheContext.Provider value={new Map()}>{children}</CacheContext.Provider>
  )
}

export const makeUseEffectSuspense =
  <R,>(runtime: RuntimeContext<R>) =>
  <E, A>(effect: Effect.Effect<R, E, A>) => {
    const runner = useEffectRunnerPromise(runtime)
    const cache = useContext(CacheContext)

    const entry = cache.get(effect) as CacheEntry<E, A>

    if (!entry) {
      const promise = runner(Effect.either(effect)).then((a) => {
        cache.set(effect, E.right(a))
      })
      cache.set(effect, E.left(promise))
      throw promise
    }

    if (entry._tag === "Left") {
      throw entry.left
    } else if (entry.right._tag === "Left") {
      throw entry.right.left
    }

    return entry.right.right
  }

export const useInvalidateEffect = (
  effect: Effect.Effect<unknown, unknown, unknown>,
) => {
  const cache = useContext(CacheContext)
  return () => cache.delete(effect)
}
