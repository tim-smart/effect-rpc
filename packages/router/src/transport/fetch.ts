import { RpcClientTransport } from "../client.js"

export interface FetchTransportOptions {
  readonly url: string
  readonly method?: string
  readonly headers?: Record<string, string>
}

export class FetchError {
  readonly _tag = "FetchError"
  constructor(readonly reason: unknown) {}
}

export const make = ({
  url,
  method = "POST",
  headers = {},
}: FetchTransportOptions): RpcClientTransport<never, FetchError> => ({
  send: (u) =>
    Effect.tryCatchPromiseAbort(
      (signal) =>
        fetch(url, {
          method,
          headers: {
            ...headers,
            "content-type": "application/json",
          },
          signal,
          body: JSON.stringify(u),
        }).then((r) => r.json()),
      (reason) => new FetchError(reason),
    ),
})
