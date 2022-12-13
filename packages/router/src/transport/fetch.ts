export interface FetchTransportOptions {
  url: string
  headers?: Record<string, string>
}

export class FetchError {
  readonly _tag = "FetchError"
  constructor(readonly reason: unknown) {}
}

export const make =
  ({ url, headers = {} }: FetchTransportOptions) =>
  (u: unknown) =>
    Effect.tryCatchPromise(
      () =>
        fetch(url, {
          method: "POST",
          headers: {
            ...headers,
            "content-type": "application/json",
          },
          body: JSON.stringify(u),
        }).then((r) => r.json()),
      (reason) => new FetchError(reason),
    )
