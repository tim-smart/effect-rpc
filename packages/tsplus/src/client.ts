import type { DecodePayloadFailure, Decoder } from "@tsplus/runtime/Decoder"
import type { Encoder } from "@tsplus/runtime/Encoder"
import * as TSE from "@tsplus/stdlib/data/Either"
import type { Check } from "@tsplus/stdlib/type-level"
import {
  RpcHandlerCodecNoInput,
  RpcHandlerCodecWithInput,
  RpcRouter,
} from "./server.js"
import { RpcRequest, RpcResponse, RpcServerError } from "./shared.js"

/**
 * @tsplus type Rpc
 */
export type Rpc<C extends RpcCodec<any>, TR, TE> = C extends RpcCodecWithInput<
  infer E,
  infer I,
  infer O
>
  ? (input: I) => Effect<TR, RpcServerError | DecodePayloadFailure | TE | E, O>
  : C extends RpcCodecNoInput<infer E, infer O>
  ? Effect<TR, RpcServerError | DecodePayloadFailure | TE | E, O>
  : never

interface RpcCodecNoInput<E, O> {
  readonly output: Decoder<O>
  readonly error: Decoder<E>
}

interface RpcCodecWithInput<E, I, O> extends RpcCodecNoInput<E, O> {
  readonly input: Encoder<I>
}

/**
 * @tsplus type RpcCodec
 * @tsplus derive nominal
 */
export type RpcCodec<
  C extends
    | RpcHandlerCodecNoInput<any, any>
    | RpcHandlerCodecNoInput<any, never>
    | RpcHandlerCodecNoInput<never, any>
    | RpcHandlerCodecWithInput<any, any, any>
    | RpcHandlerCodecWithInput<any, any, never>
    | RpcHandlerCodecWithInput<any, never, any>,
> = C extends RpcHandlerCodecWithInput<infer E, infer I, infer O>
  ? RpcCodecWithInput<E, I, O>
  : C extends RpcHandlerCodecNoInput<infer E, infer O>
  ? RpcCodecNoInput<E, O>
  : never

/**
 * @tsplus derive RpcCodec[RpcHandlerCodecWithInput]<_, _, _, _> 10
 */
export const deriveRpcCodec = <
  A extends RpcHandlerCodecWithInput<any, any, any>,
>(
  ...[input, output, error]: [A] extends [
    RpcHandlerCodecWithInput<infer _E, infer _I, infer _O>,
  ]
    ? Check.IsEqual<A, RpcHandlerCodecWithInput<_E, _I, _O>> extends [never]
      ? never
      : [input: Encoder<_I>, output: Decoder<_O>, error: Decoder<_E>]
    : never
): RpcCodec<A> => {
  return {
    input,
    output,
    error,
  } as any
}

export interface RpcCodecs extends Record<string, RpcCodec<any>> {}

export type RpcCodecsFromRouter<R extends RpcRouter<any>> = {
  [K in keyof R["codecs"]]: RpcCodec<R["codecs"][K]>
}

export type RpcClient<S extends RpcCodecs, TR, TE> = {
  [K in keyof S]: Rpc<S[K], TR, TE>
}

/**
 * @tsplus derive RpcCodec[RpcHandlerCodecNoInput]<_, _, _, _> 10
 */
export const deriveRpcCodecEffect = <
  A extends RpcHandlerCodecNoInput<any, any>,
>(
  ...[output, error]: [A] extends [RpcHandlerCodecNoInput<infer _E, infer _O>]
    ? Check.IsEqual<A, RpcHandlerCodecNoInput<_E, _O>> extends [never]
      ? never
      : [output: Decoder<_O>, error: Decoder<_E>]
    : never
): RpcCodec<A> => {
  return {
    output,
    error,
  } as any
}

export interface RpcClientTransport<R, E> {
  send: (u: unknown) => Effect<R, E, unknown>
}

const requestEncoder = Derive<Encoder<RpcRequest>>()
const responseDecoder = Derive<Decoder<RpcResponse>>()
const errorDecoder = Derive<Decoder<RpcServerError>>()

export const make = <
  S extends RpcCodecs,
  T extends RpcClientTransport<any, any>,
>(
  codecs: S,
  transport: T,
) =>
  Object.entries(codecs).reduce<
    RpcClient<
      S,
      T extends RpcClientTransport<infer R, any> ? R : never,
      T extends RpcClientTransport<any, infer E> ? E : never
    >
  >(
    (acc, [method, codec]) => ({
      ...acc,
      [method]: makeRpc(transport, codec, method),
    }),
    {} as any,
  )

export const makeFromRouter =
  <R extends RpcRouter<any>>(codecs: RpcCodecsFromRouter<R>) =>
  <TR, TE>(transport: RpcClientTransport<TR, TE>) =>
    make(codecs, transport)

const makeRpc = <C extends RpcCodec<any>, TR, TE>(
  transport: RpcClientTransport<TR, TE>,
  codec: C,
  method: string,
): Rpc<C, TR, TE> => {
  const send = (input: unknown) =>
    transport
      .send(
        requestEncoder.encode({
          method: method as string,
          input,
        }),
      )
      .flatMap((u) =>
        responseDecoder
          .decode(u)
          .flatMap((a) =>
            a.fold(
              (e) =>
                codec.error
                  .decode(e)
                  .orElse(() => errorDecoder.decode(e))
                  .flatMap((e) => TSE.left(e)),
              (a) => codec.output.decode(a),
            ),
          )
          .fold(
            (e) => Effect.fail(e),
            (a) => Effect.succeed(a),
          ),
      )

  if ("input" in codec) {
    return ((input: any) => send(codec.input.encode(input))) as any
  }

  return send(null) as any
}
