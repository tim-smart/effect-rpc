import * as Effect from "@effect/io/Effect"
import * as E from "@fp-ts/data/Either"
import * as Equal from "@fp-ts/data/Equal"
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react"
import { RuntimeContext, useEffectRunnerPromise } from "./runtime.js"

type CacheEntry<E, A> = E.Either<Promise<void>, E.Either<E, A>>
type Cache = Map<number, CacheEntry<unknown, unknown>>

const CacheContext = createContext<Cache>(new Map())

export const EffectSuspenseProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo<Cache>(() => new Map(), [])
  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
}

export const makeUseEffectSuspense =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <E, A>(effect: Effect.Effect<R, E, A>, key?: any) => {
    const runner = useEffectRunnerPromise(runtime)
    const cache = useContext(CacheContext)
    const cacheKey = useMemo(() => Equal.hash(key ?? effect), [effect, key])

    const entry = cache.get(cacheKey) as CacheEntry<E, A>

    if (!entry) {
      const promise = runner(Effect.either(effect)).then((a) => {
        cache.set(cacheKey, E.right(a))
      })

      cache.set(cacheKey, E.left(promise))

      throw promise
    }

    if (entry._tag === "Left") {
      throw entry.left
    } else if (entry.right._tag === "Left") {
      throw entry.right.left
    }

    return entry.right.right
  }

export const useInvalidateEffect = (effectOrKey: any) => {
  const cache = useContext(CacheContext)
  return () => cache.delete(Equal.hash(effectOrKey))
}
