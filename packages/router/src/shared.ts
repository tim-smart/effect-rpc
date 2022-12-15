import * as TSE from "@tsplus/stdlib/data/Either"

/**
 * @tsplus implicit
 */
export const _unknownD = Decoder<unknown>((u) => Result.success(u))

/**
 * @tsplus implicit
 */
export const _unknownE = Encoder<unknown>((u) => u)

export type RpcRequest = {
  method: string
  input: unknown
}

export interface RpcNotFound {
  readonly _tag: "RpcNotFound"
  readonly method: string
}

export type RpcServerError = DecodePayloadFailure | RpcNotFound

export type RpcResponse = TSE.Either<unknown, unknown>

// Codecs

export interface RpcSharedCodecNoInput<E, O> {
  output: Encoder<O> & Decoder<O>
  error: Encoder<E> & Decoder<E>
}

export interface RpcSharedCodecWithInput<E, I, O>
  extends RpcSharedCodecNoInput<E, O> {
  input: Decoder<I> & Encoder<I>
}

export type RpcSharedCodec<E, I, O> =
  | RpcSharedCodecNoInput<E, O>
  | RpcSharedCodecWithInput<E, I, O>

export interface RpcSharedCodecs
  extends Record<
    string,
    | RpcSharedCodec<any, any, any>
    | RpcSharedCodec<never, any, any>
    | RpcSharedCodec<any, never, any>
  > {}

export const makeCodecs = <S extends RpcSharedCodecs>(codecs: S) => codecs
