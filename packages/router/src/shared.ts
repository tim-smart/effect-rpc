import * as Codec from "@fp-ts/schema/Codec"
import { DecodeError } from "@fp-ts/schema/DecodeError"

const inputError = Codec.struct({
  _tag: Codec.literal("InputError"),
  errors: Codec.nonEmptyArray(Codec.unknown),
})
export interface InputError {
  readonly _tag: "InputError"
  readonly errors: readonly [DecodeError, ...DecodeError[]]
}

const rpcNotFound = Codec.struct({
  _tag: Codec.literal("RpcNotFound"),
  name: Codec.string,
})
export interface RpcNotFound extends Codec.Infer<typeof rpcNotFound> {}

export const rpcError = <E>(e: Codec.Codec<E>) =>
  Codec.union(inputError, rpcNotFound, e)

export type RpcError<E> = E | InputError | RpcNotFound

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
