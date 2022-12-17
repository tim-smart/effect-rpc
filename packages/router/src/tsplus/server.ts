import * as S from "../server.js"

export { makeHandler } from "../server.js"

export interface RpcRouter<H extends S.RpcHandlers> extends S.RpcRouterBase {
  readonly handlers: H
  readonly codecs: RpcCodecsFromHandlers<H>
}

export type RpcCodecsFromHandlers<H extends S.RpcHandlers> = {
  [K in keyof H]: H[K] extends Effect<any, infer E, infer O>
    ? S.RpcHandlerCodecNoInput<E, O>
    : H[K] extends S.RpcDefinitionIO<any, infer E, infer I, infer O>
    ? S.RpcHandlerCodecWithInput<E, I, O>
    : never
}
export const makeRouter = <H extends S.RpcHandlers>(
  handlers: H,
  codecs: RpcCodecsFromHandlers<H>,
): RpcRouter<H> => ({
  handlers,
  codecs,
})

// === derive

/**
 * @tsplus derive effect-rpc/router/RpcHandlerCodecNoInput<_, _> 10
 */
export const deriveRpcHandlerCodecNoInput = <E, O>(
  ...[output, error]: [output: Encoder<O>, error: Encoder<E>]
): S.RpcHandlerCodecNoInput<E, O> => {
  return {
    output,
    error,
  }
}

/**
 * @tsplus derive effect-rpc/router/RpcHandlerCodecWithInput<_, _, _> 10
 */
export const deriveRpcHandlerCodecWithInput = <E, I, O>(
  ...[input, output, error]: [
    input: Decoder<I>,
    output: Encoder<O>,
    error: Encoder<E>,
  ]
): S.RpcHandlerCodecWithInput<E, I, O> => {
  return {
    input,
    output,
    error,
  }
}
