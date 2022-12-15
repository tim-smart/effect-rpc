import { makeCodecs, Client, Server } from "./index.js"
import * as Decoder from "@tsplus/runtime/Decoder"
import * as Encoder from "@tsplus/runtime/Encoder"

// Server

const _never: Encoder.Encoder<never> & Decoder.Decoder<never> = {
  ...Decoder.deriveLazy((a) => Decoder.deriveNamed(a)),
  ...Encoder.deriveLazy((a) => Encoder.deriveNamed(a)),
}

// Pretend this is @fp-ts/schema
export const codecs = makeCodecs({
  hello: {
    input: {
      ...Decoder.string,
      ...Encoder.string,
    },
    error: _never,
    output: {
      ...Decoder.string,
      ...Encoder.string,
    },
  },
})

export const handler = Server.make(codecs, {
  hello: (name) => Effect.succeed(`Hello ${name}`),
})

// Client
const transport = { send: handler }
const client = Client.make(codecs, transport)

client.hello("Tim").unsafeRunPromise.then(console.error).catch(console.error)
