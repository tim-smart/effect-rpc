import { rpc, schema, Server } from "@effect-rpc/router"
import * as Codec from "@fp-ts/schema/Codec"
import { Effect } from "./common.js"

export const routes = schema({
  multiply: rpc({
    input: Codec.tuple(Codec.number, Codec.number),
    output: Codec.number,
    error: Codec.never,
  }),
})

export const handlers = Server.handlers(routes, {
  multiply: ([a, b]) => Effect.succeed(a * b),
})
