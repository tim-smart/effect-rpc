import { Server } from "@effect-rpc/router"
import Express from "express"
import { Effect, Exit } from "./common.js"
import { routes } from "./schema.js"

const handler = Server.make(routes)({
  hello: (i) =>
    Effect.succeed({
      greeting: `Hello ${i.name}`,
    }),
  fail: (_) =>
    Effect.fail({
      _tag: "Bad",
    }),
  multiply: ([a, b]) => Effect.succeed(a * b),
})

const app = Express()
app.use(Express.json())
app.post("/api", (req, res) =>
  Effect.unsafeRunAsyncWith(handler(req.body), (exit) => {
    if (Exit.isSuccess(exit)) {
      res.send(exit.value)
    } else {
      res.writeHead(500)
      res.end()
    }
  }),
)

app.listen(3000)
