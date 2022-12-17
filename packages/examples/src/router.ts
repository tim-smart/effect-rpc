import { makeHandler, makeRouter } from "@effect-rpc/router/tsplus/server"
import * as Effect from "@effect/io/Effect"

const router = makeRouter(
  {
    hello: (name: string) =>
      Effect.succeed({
        greeting: `Hello ${name}!`,
        sentAt: new Date(),
      }),

    fail: Effect.fail({
      _tag: "Fail",
    } as const),
  },
  Derive(),
)

export type Router = typeof router

export const handler = makeHandler(router)
