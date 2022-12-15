import { Server } from "@effect-rpc/router"
import * as Effect from "@effect/io/Effect"

const router = Server.router(
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

export const handler = Server.makeFromRouter(router)
