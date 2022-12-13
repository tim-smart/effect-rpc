import * as Codec from "@fp-ts/schema/Codec"
import { DecodeError } from "@fp-ts/schema/DecodeError"

const decoderError = Codec.struct({
  _tag: Codec.literal("DecoderError"),
  errors: Codec.nonEmptyArray(Codec.unknown),
})
export interface DecoderError {
  readonly _tag: "DecoderError"
  readonly errors: readonly [DecodeError, ...DecodeError[]]
}

const rpcNotFound = Codec.struct({
  _tag: Codec.literal("RpcNotFound"),
  name: Codec.string,
})
export interface RpcNotFound extends Codec.Infer<typeof rpcNotFound> {}

export const rpcError = <E>(e: Codec.Codec<E>) =>
  Codec.union(decoderError, rpcNotFound, e)

export type RpcError<E> = E | DecoderError | RpcNotFound

export const success = <O>(output: Codec.Codec<O>) =>
  Codec.struct({
    _tag: Codec.literal("success"),
    value: output,
  })

export const failure = <E>(e: Codec.Codec<E>) =>
  Codec.struct({
    _tag: Codec.literal("failure"),
    error: rpcError(e),
  })

export const rpcRequest = <I>(a: Codec.Codec<I>) =>
  Codec.struct({
    name: Codec.string,
    input: a,
  })

export const rpcResult = <E, O>(e: Codec.Codec<E>, a: Codec.Codec<O>) =>
  Codec.union(success(a), failure(e))
