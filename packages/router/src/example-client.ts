import { Client } from "./index.js"
import * as FetchTransport from "./transport/fetch.js"
import { routes } from "./example.js"

const client = Client.make(
  FetchTransport.make({
    url: "http://localhost:3000/api",
  }),
)(routes)

client
  .hello({ name: "Tim" })
  // .fail({ name: "Tim" })
  .unsafeRunPromiseExit.then((exit) => {
    if (Exit.isFailure(exit)) {
      console.error(exit.cause.pretty())
    } else {
      console.error(exit.value)
    }
  })
