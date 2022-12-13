import { Client, makeFetchTransport } from "@effect-rpc/router"
import { Cause, Effect, Exit, pipe } from "./common.js"
import { routes } from "./schema.js"

const client = Client.make(
  makeFetchTransport({
    url: "http://localhost:3000/api",
  }),
)(routes)

const program = Effect.gen(function* ($) {
  console.error(yield* $(client.hello({ name: "Tim" })))
  console.error(yield* $(client.multiply([2, 4])))

  // This will fail
  yield* $(client.fail({ name: "Tim" }))
})

pipe(program, Effect.unsafeRunPromiseExit).then((exit) => {
  if (Exit.isFailure(exit)) {
    console.error(Cause.pretty()(exit.cause))
  }
})
