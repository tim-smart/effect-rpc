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
type Cache = WeakMap<
  Effect.Effect<unknown, unknown, unknown>,
  CacheEntry<unknown, unknown>
>

const CacheContext = createContext<Cache>(new WeakMap())

export const EffectSuspenseProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo<Cache>(() => new WeakMap(), [])
  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
}

export const makeUseEffectSuspense =
  <R, EC>(runtime: RuntimeContext<R, EC>) =>
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

useInvalidateEffect(Effect.succeed(1))
