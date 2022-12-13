import { rpc, schema } from "@effect-rpc/router"
import * as Codec from "@fp-ts/schema/Codec"

const one = schema({
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

const another = schema({
  multiply: rpc({
    input: Codec.tuple(Codec.number, Codec.number),
    output: Codec.number,
    error: Codec.never,
  }),
})

export const routes = {
  ...one,
  ...another,
}
