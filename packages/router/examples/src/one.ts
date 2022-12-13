import { rpc, schema, Server } from "@effect-rpc/router"
import { none } from "@effect-rpc/router/schema"
import * as Codec from "@fp-ts/schema/Codec"
import { Effect } from "./common.js"

const hello = rpc({
  input: Codec.struct({
    name: Codec.string,
  }),
  output: Codec.union(
    Codec.struct({
      greeting: Codec.string,
    }),
  ),
  error: Codec.never,
})

const handleHello = Server.handler(hello)(({ name }) =>
  Effect.succeed({
    greeting: `Hello ${name}`,
  }),
)

const fail = rpc({
  input: none,
  output: Codec.struct({
    greeting: Codec.string,
  }),
  error: Codec.struct({
    _tag: Codec.literal("Bad"),
  }),
})

const handleFail = Server.handler(fail)(() =>
  Effect.fail({
    _tag: "Bad",
  }),
)

export const routes = schema({
  hello,
  fail,
})

export const handlers = Server.handlers(routes, {
  hello: handleHello,
  fail: handleFail,
})
