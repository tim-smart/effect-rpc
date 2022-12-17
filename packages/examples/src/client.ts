import * as Client from "@effect-rpc/router/tsplus/client"
import type { Router } from "./router.js"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Cause from "@effect/io/Cause"
import { Transport } from "@effect-rpc/router"

const transport = Transport.Fetch.make({
  url: "http://localhost:3000/rpc",
})

const client = Client.make<Router>(Derive())(transport)

const program = Effect.gen(function* ($) {
  const value = yield* $(client.hello("Tim"))
  console.error(value)

  yield* $(client.fail)
})

Effect.unsafeRunPromiseExit(program).then((exit) => {
  if (Exit.isSuccess(exit)) {
    console.log("SUCCESS", exit.value)
  } else {
    console.log(Cause.pretty()(exit.cause))
  }
})
