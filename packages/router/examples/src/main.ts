import Express from "express"
import { Effect, Exit } from "./common.js"
import { handler } from "./server.js"

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
