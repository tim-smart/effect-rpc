import { make as makeClient, RpcClientTransport, RpcCodec } from "../client.js"
import type {
  RpcHandlerCodecNoInput,
  RpcHandlerCodecWithInput,
  RpcRouterBase,
} from "../server.js"

export type RpcCodecsFromRouter<R extends RpcRouterBase> = {
  [K in keyof R["codecs"]]: RpcCodec<R["codecs"][K]>
}

export const make =
  <R extends RpcRouterBase>(codecs: RpcCodecsFromRouter<R>) =>
  <TR, TE>(transport: RpcClientTransport<TR, TE>) =>
    makeClient(codecs, transport)

/**
 * @tsplus derive effect-rpc/router/RpcCodec[effect-rpc/router/RpcHandlerCodecNoInput]<_, _, _, _> 10
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

/**
 * @tsplus derive effect-rpc/router/RpcCodec[effect-rpc/router/RpcHandlerCodecWithInput]<_, _, _, _> 10
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
