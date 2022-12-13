import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import * as These from "@fp-ts/data/These"

export type SendOutgoing<R, E> = (u: unknown) => Effect<R, E, unknown>

type Routes<R extends RpcSchema, Deps, Error> = {
  [N in keyof R]: R[N] extends ProcedureDefinition<infer E, infer I, infer O>
    ? (input: I) => Effect<Deps, Error | RpcError<E>, O>
    : never
}

export const make =
  <SendDeps, SendError>(send: SendOutgoing<SendDeps, SendError>) =>
  <R extends RpcSchema>(schema: R): Routes<R, SendDeps, SendError> => {
    return Object.entries(schema).reduce<Routes<R, SendDeps, SendError>>(
      (acc, [name, rpc]) => ({
        ...acc,
        [name]: makeRpc(send)(name, rpc as any),
      }),
      {} as any,
    )
  }

const makeRpc =
  <SendDeps, SendError>(send: SendOutgoing<SendDeps, SendError>) =>
  <E, I, O>(
    name: string,
    [inputCodec, outputCodec, errorCodec]: ProcedureDefinition<E, I, O>,
  ) =>
  (input: I) =>
    send(
      rpcRequest(inputCodec).encode({
        name,
        input,
      }),
    ).flatMap((a) =>
      pipe(
        rpcResult(errorCodec, outputCodec).decode(a),
        These.mapLeft(
          (errors): DecoderError => ({
            _tag: "DecoderError",
            errors,
          }),
        ),
        These.toEither((_, a) => Either.right(a)),
        Either.flatMap((a) =>
          a._tag === "success"
            ? Either.right(a.value)
            : Either.left(a.error as unknown as RpcError<E>),
        ),
        Effect.fromEither,
      ),
    )
