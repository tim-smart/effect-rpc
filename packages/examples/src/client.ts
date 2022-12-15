import { Client, makeFetchTransport } from "@effect-rpc/router"
import type { Router } from "./router.js"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Cause from "@effect/io/Cause"

const transport = makeFetchTransport({
  url: "http://localhost:3000/rpc",
})

const client = Client.makeFromRouter<Router>(Derive())(transport)

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
