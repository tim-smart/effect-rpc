import * as Effect from "@effect/io/Effect"
import * as E from "@fp-ts/data/Either"
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react"
import { RuntimeContext, useEffectRunnerPromise } from "./runtime.js"

type CacheEntry<E, A> = E.Either<Promise<void>, E.Either<E, A>>

interface Cache {
  keys: Map<string, CacheEntry<unknown, unknown>>
  effects: WeakMap<Effect.Effect<any, any, any>, CacheEntry<unknown, unknown>>
}

const CacheContext = createContext<Cache>({
  keys: new Map(),
  effects: new WeakMap(),
})

export const EffectSuspenseProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo<Cache>(
    () => ({
      keys: new Map(),
      effects: new WeakMap(),
    }),
    [],
  )
  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
}

export const makeUseEffectSuspense =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <E, A>(effect: Effect.Effect<R, E, A>, key?: string) => {
    const runner = useEffectRunnerPromise(runtime)
    const cache = useContext(CacheContext)

    const entry = (
      key ? cache.keys.get(key) : cache.effects.get(effect)
    ) as CacheEntry<E, A>

    if (!entry) {
      const promise = runner(Effect.either(effect)).then((a) => {
        if (key) {
          cache.keys.set(key, E.right(a))
        } else {
          cache.effects.set(effect, E.right(a))
        }
      })

      if (key) {
        cache.keys.set(key, E.left(promise))
      } else {
        cache.effects.set(effect, E.left(promise))
      }

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
  return () => cache.effects.delete(effect)
}

export const useInvalidateKey = (key: string) => {
  const cache = useContext(CacheContext)
  return () => cache.keys.delete(key)
}
