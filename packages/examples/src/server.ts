import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import Express from "express"
import { handler } from "./router.js"

const app = Express()
app.use(Express.json())

app.post("/rpc", (req, res) => {
  Effect.unsafeRunAsyncWith(handler(req.body), (exit) => {
    if (Exit.isSuccess(exit)) {
      res.send(exit.value)
    } else {
      res.writeHead(500)
      res.end()
    }
  })
})

app.listen(3000)
