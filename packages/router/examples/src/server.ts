import { Server } from "@effect-rpc/router"
import Express from "express"
import { Effect, Exit } from "./common.js"
import * as One from "./one.js"
import * as Two from "./two.js"

export const schema = {
  ...One.routes,
  ...Two.routes,
}

const handle = Server.make(schema, {
  ...One.handlers,
  ...Two.handlers,
})

const app = Express()
app.use(Express.json())
app.post("/api", (req, res) =>
  Effect.unsafeRunAsyncWith(handle(req.body), (exit) => {
    if (Exit.isSuccess(exit)) {
      res.send(exit.value)
    } else {
      res.writeHead(500)
      res.end()
    }
  }),
)

app.listen(3000)
