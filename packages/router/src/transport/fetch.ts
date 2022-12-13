export interface FetchHandlerOpts {
  url: string
  headers?: Record<string, string>
}

export class FetchError {
  readonly _tag = "FetchError"
  constructor(readonly reason: unknown) {}
}

export const make =
  ({ url, headers = {} }: FetchHandlerOpts) =>
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
        }).then((r) => r.json() as unknown),
      (reason) => new FetchError(reason),
    )
