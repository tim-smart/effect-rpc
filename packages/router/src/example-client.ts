import { Client, makeFetchTransport } from "./index.js"
import { routes } from "./example.js"

const client = Client.make(
  makeFetchTransport({
    url: "http://localhost:3000/api",
  }),
)(routes)

client
  .hello({ name: "Tim" })
  // .fail({ name: "Hello" })
  .unsafeRunPromiseExit.then((exit) => {
    if (Exit.isFailure(exit)) {
      console.error(exit.cause.pretty())
    } else {
      console.error(exit.value)
    }
  })
