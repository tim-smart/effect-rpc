import { Server } from "@effect-rpc/router"
import * as One from "./one.js"
import * as Two from "./two.js"

export const schema = {
  ...One.routes,
  ...Two.routes,
}

export const handler = Server.make(schema, {
  ...One.handlers,
  ...Two.handlers,
})
