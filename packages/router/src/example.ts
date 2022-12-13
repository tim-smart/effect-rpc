import * as Codec from "@fp-ts/schema/Codec"
import { rpc, schema } from "./index.js"

export const routes = schema({
  hello: rpc(
    // input
    Codec.struct({
      name: Codec.string,
    }),
    // output
    Codec.struct({
      greeting: Codec.string,
    }),
    // error
    Codec.never,
  ),
  fail: rpc(
    // input
    Codec.struct({
      name: Codec.string,
    }),
    // output
    Codec.struct({
      greeting: Codec.string,
    }),
    // error
    Codec.struct({
      _tag: Codec.literal("Bad"),
    }),
  ),
})
