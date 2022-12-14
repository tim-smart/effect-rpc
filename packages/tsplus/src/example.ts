import { Client, Server } from "./index.js"

// server
export const router = Server.router(
  {
    hello: (name: string) => Effect.succeed(`Hello ${name}`),
    fail: Effect.fail({
      _tag: "Fail" as const,
    }),
  },
  Derive(),
)
export type MyRouter = typeof router

export const handler = Server.makeFromRouter(router)

// Client
const transport = { send: handler }
const client = Client.makeFromRouter<MyRouter>(Derive())(transport)

client.hello("Tim").unsafeRunPromise.then(console.error).catch(console.error)
