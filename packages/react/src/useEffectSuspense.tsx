import * as Effect from "@effect/io/Effect"
import * as Runtime from "@effect/io/Runtime"
import * as E from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import React, {
  Context,
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react"

type CacheEntry<E, A> = E.Either<Promise<void>, E.Either<E, A>>

const CacheContext = createContext<Map<string, CacheEntry<any, any>>>(
  null as any,
)

export const EffectSuspenseProvider = ({ children }: PropsWithChildren) => {
  return (
    <CacheContext.Provider value={new Map()}>{children}</CacheContext.Provider>
  )
}

export interface EffectSuspenseOpts<R> {
  key: string
  runtime: Context<Runtime.Runtime<R>>
  deps?: any[]
}

export const useEffectSuspense = <R, E, A>(
  f: () => Effect.Effect<R, E, A>,
  { key, runtime, deps = [] }: EffectSuspenseOpts<R>,
) => {
  const rt = useContext(runtime)
  const cache = useContext(CacheContext)
  const effect = useMemo(() => pipe(f(), Effect.either), deps)

  const refresh = () => {
    const promise = rt.unsafeRunPromise(effect).then((a) => {
      cache.set(key, E.right(a))
    })
    cache.set(key, E.left(promise))
    throw promise
  }

  const entry = cache.get(key) as CacheEntry<E, A>

  if (!entry) {
    refresh()
  }

  if (entry._tag === "Left") {
    throw entry.left
  } else if (entry.right._tag === "Left") {
    throw entry.right.left
  }

  return {
    value: entry.right.right,
    refresh,
  }
}
