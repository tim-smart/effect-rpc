import * as Codec from "@fp-ts/schema/Codec"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import * as These from "@fp-ts/data/These"

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

export const make =
  <R extends RpcSchema>(router: R) =>
  <H extends Handlers<R>>(handlers: H) =>
  (u: unknown) => {
    const either = Do(($) => {
      const input = $(
        pipe(
          requestCodec.decode(u),
          These.mapLeft(
            (errors): InputError => ({
              _tag: "InputError",
              errors,
            }),
          ),
          These.toEither((e, _) => Either.left(e)),
        ),
      )

      const [inputCodec, outputCodec, errorCodec] = $(
        pipe(
          router[input.name],
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
            (errors): InputError => ({
              _tag: "InputError",
              errors,
            }),
          ),
          These.toEither((e, _) => Either.left(e)),
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
    ) as Effect<HandlerDeps<R, H>, never, unknown>
  }
