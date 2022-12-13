import { rpc, schema, Server } from "@effect-rpc/router"
import * as Codec from "@fp-ts/schema/Codec"
import { Effect } from "./common.js"

export const routes = schema({
  hello: rpc({
    input: Codec.struct({
      name: Codec.string,
    }),
    output: Codec.struct({
      greeting: Codec.string,
    }),
    error: Codec.never,
  }),
  fail: rpc({
    input: Codec.struct({
      name: Codec.string,
    }),
    output: Codec.struct({
      greeting: Codec.string,
    }),
    error: Codec.struct({
      _tag: Codec.literal("Bad"),
    }),
  }),
})

export const handlers = Server.handlers(routes, {
  hello: (i) =>
    Effect.succeed({
      greeting: `Hello ${i.name}`,
    }),
  fail: (_) =>
    Effect.fail({
      _tag: "Bad",
    }),
})
