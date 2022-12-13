import Express from "express"
import { routes } from "./example.js"
import { Server } from "./index.js"

const handler = Server.make(routes)({
  hello: (i) =>
    Effect.succeed({
      greeting: `Hello ${i.name}`,
    }),
  fail: (_) =>
    Effect.fail({
      _tag: "Bad",
    }),
})

const app = Express()
app.use(Express.json())
app.post("/api", (req, res) =>
  handler(req.body).unsafeRunAsyncWith((exit) => {
    if (Exit.isSuccess(exit)) {
      res.send(exit.value)
    } else {
      res.writeHead(500)
      res.end()
    }
  }),
)

app.listen(3000)
