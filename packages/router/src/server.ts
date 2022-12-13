export type Handlers<R extends RpcSchema> = {
  [N in keyof R]: R[N] extends ProcedureDefinition<infer E, infer I, infer O>
    ? (input: I) => Effect<any, E, O>
    : never
}

type HandlerDeps<R extends RpcSchema, H extends Handlers<R>> = ReturnType<
  H[keyof H]
> extends Effect<infer Deps, any, any>
  ? Deps
  : never

const requestCodec = rpcRequest(Codec.unknown)
const failureJson = failure(Codec.json)

export const handlers = <S extends RpcSchema, H extends Handlers<S>>(
  _: S,
  handlers: H,
) => handlers

export const make =
  <S extends RpcSchema, H extends Handlers<S>>(schema: S, handlers: H) =>
  (u: unknown) => {
    const either = Do(($) => {
      const input = $(
        pipe(
          requestCodec.decode(u),
          These.mapLeft(
            (errors): DecoderError => ({
              _tag: "DecoderError",
              errors,
            }),
          ),
          These.toEither((_, a) => Either.right(a)),
        ),
      )

      const [inputCodec, outputCodec, errorCodec] = $(
        pipe(
          schema[input.name],
          Either.fromNullable(
            (): RpcNotFound => ({
              _tag: "RpcNotFound",
              name: input.name,
            }),
          ),
        ),
      )

      const execute = handlers[input.name]!

      const data = $(
        pipe(
          inputCodec.decode(input.input),
          These.mapLeft(
            (errors): DecoderError => ({
              _tag: "DecoderError",
              errors,
            }),
          ),
          These.toEither((_, a) => Either.right(a)),
        ),
      )

      return execute(data)
        .map((output) =>
          success(outputCodec).encode({
            _tag: "success",
            value: output,
          }),
        )
        .catchAll((error) =>
          Effect.succeed(
            failure(errorCodec as any).encode({
              _tag: "failure",
              error,
            }),
          ),
        )
    })

    return Effect.fromEither(either).flatten.catchAll((error) =>
      Effect.succeed(
        failureJson.encode({
          _tag: "failure",
          error,
        }),
      ),
    ) as Effect<HandlerDeps<S, H>, never, unknown>
  }
