import * as TSE from "@tsplus/stdlib/data/Either"
import * as Eq from "@fp-ts/data/Equal"
import { RpcHandlerCodecNoInput, RpcHandlerCodecWithInput } from "./server.js"
import { RpcRequest, RpcResponse, RpcServerError } from "./shared.js"

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
 * @tsplus type effect-rpc/router/RpcCodec
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

export interface RpcCodecs extends Record<string, RpcCodec<any>> {}

export type RpcClient<S extends RpcCodecs, TR, TE> = {
  [K in keyof S]: Rpc<S[K], TR, TE>
} & {
  _codecs: S
  _unsafeDecode: <M extends keyof S>(
    method: M,
    output: unknown,
  ) => S[M] extends { output: Decoder<infer O> } ? O : never
}

export interface RpcClientTransport<R, E> {
  send: (u: unknown) => Effect<R, E, unknown>
}

const requestEncoder = Derive<Encoder<RpcRequest>>()
const responseDecoder = Derive<Decoder<RpcResponse>>()
const errorDecoder = Derive<Decoder<RpcServerError>>()

const unsafeDecode =
  <S extends RpcCodecs>(codecs: S) =>
  (method: keyof S, output: unknown) => {
    const a = codecs[method].output.decodeResult(output)
    if (a._tag !== "Failure") {
      return a.success
    }

    throw "unsafeDecode fail"
  }

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
    { _codecs: codecs, _unsafeDecode: unsafeDecode(codecs) } as any,
  )

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
    const cache = new Map<number, Effect<unknown, unknown, unknown>>()
    return ((input: any) => {
      const hash = Eq.hash(input)
      if (cache.has(hash)) {
        return cache.get(hash)
      }

      const effect = send(input)
      cache.set(hash, effect)
      return effect
    }) as any
  }

  return send(null) as any
}
