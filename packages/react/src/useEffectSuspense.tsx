import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react"
import { RuntimeContext, useEffectRunnerPromise } from "./runtime.js"

type CacheEntry<E, A> = Either<Promise<void>, Either<E, A>>
type Cache = WeakMap<
  Effect<unknown, unknown, unknown>,
  CacheEntry<unknown, unknown>
>

const CacheContext = createContext<Cache>(new WeakMap())

export const EffectSuspenseProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo<Cache>(() => new WeakMap(), [])
  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
}

export const makeUseEffectSuspense =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
  <E, A>(effect: Effect<R, E, A>) => {
    const runner = useEffectRunnerPromise(runtime)
    const cache = useContext(CacheContext)

    const entry = cache.get(effect) as CacheEntry<E, A>

    if (!entry) {
      const promise = runner(effect.either).then((a) => {
        cache.set(effect, Either.right(a))
      })

      cache.set(effect, Either.left(promise))

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
  effect: Effect<unknown, unknown, unknown>,
) => {
  const cache = useContext(CacheContext)
  return () => cache.delete(effect)
}

useInvalidateEffect(Effect.succeed(1))
