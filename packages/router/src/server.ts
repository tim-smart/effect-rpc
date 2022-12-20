import * as TSE from "@tsplus/stdlib/data/Either"
import {
  RpcServerError,
  RpcNotFound,
  RpcRequest,
  RpcResponse,
} from "./shared.js"

export type RpcDefinition<R, E, I, O> =
  | RpcDefinitionIO<R, E, I, O>
  | Effect<R, E, O>

export type RpcDefinitionAny =
  | RpcDefinition<any, any, any, any>
  | RpcDefinition<any, never, any, any>
  | RpcDefinition<any, any, any, never>

export type RpcDefinitionIO<R, E, I, O> = (input: I) => Effect<R, E, O>

/**
 * @tsplus type effect-rpc/router/RpcHandlerCodecNoInput
 */
export interface RpcHandlerCodecNoInput<E, O> {
  output: Encoder<O>
  error: Encoder<E>
}

/**
 * @tsplus type effect-rpc/router/RpcHandlerCodecWithInput
 */
export interface RpcHandlerCodecWithInput<E, I, O>
  extends RpcHandlerCodecNoInput<E, O> {
  input: Decoder<I>
}

export type RpcHandlerCodec<E, I, O> =
  | RpcHandlerCodecWithInput<E, I, O>
  | RpcHandlerCodecNoInput<E, O>

export type RpcHandlerCodecAny =
  | RpcHandlerCodec<any, any, any>
  | RpcHandlerCodec<never, any, any>
  | RpcHandlerCodec<any, any, never>

export type RpcHandlerCodecFromDefinition<
  D extends RpcDefinition<any, any, any, any>,
> = D extends RpcDefinitionIO<any, infer E, infer I, infer O>
  ? RpcHandlerCodecWithInput<E, I, O>
  : D extends Effect<any, infer E, infer O>
  ? RpcHandlerCodecNoInput<E, O>
  : never

export type RpcDefinitionFromCodec<C extends RpcHandlerCodecAny> =
  C extends RpcHandlerCodecWithInput<infer E, infer I, infer O>
    ? RpcDefinitionIO<any, E, I, O>
    : C extends RpcHandlerCodecNoInput<infer E, infer O>
    ? Effect<any, E, O>
    : never

export interface RpcHandler<D extends RpcDefinition<any, any, any, any>> {
  definition: D
  codec: RpcHandlerCodecFromDefinition<D>
}

export interface RpcHandlerCodecs extends Record<string, RpcHandlerCodecAny> {}

export interface RpcHandlers extends Record<string, RpcDefinitionAny> {}

export type RpcHandlersFromCodecs<S extends RpcHandlerCodecs> = {
  [K in keyof S]: RpcDefinitionFromCodec<S[K]>
}

export type RpcHandlersDeps<H extends RpcHandlers> =
  H[keyof H] extends RpcDefinition<infer Deps, any, any, any> ? Deps : never

export type RpcHandlersE<H extends RpcHandlers> =
  H[keyof H] extends RpcDefinition<any, infer E, any, any> ? E : never

export interface RpcRouterBase {
  readonly handlers: RpcHandlers
  readonly codecs: RpcHandlerCodecs
  readonly undecoded: RpcUndecodedClient<RpcHandlers>
}

export interface RpcRouter<C extends RpcHandlerCodecs, H extends RpcHandlers>
  extends RpcRouterBase {
  readonly handlers: H
  readonly codecs: C
  readonly undecoded: RpcUndecodedClient<H>
}

const requestDecoder = Derive<Decoder<RpcRequest>>()
const responseEncoder = Derive<Encoder<RpcResponse>>()
const errorEncoder = Derive<Encoder<RpcServerError>>()

export type RpcServer<H extends RpcHandlers> = (
  u: unknown,
) => Effect<RpcHandlersDeps<H>, never, unknown>

export const makeRouter = <
  C extends RpcHandlerCodecs,
  H extends RpcHandlersFromCodecs<C>,
>(
  codecs: C,
  handlers: H,
): RpcRouter<C, H> => ({
  codecs,
  handlers,
  undecoded: makeUndecodedClient(codecs, handlers),
})

export const makeHandler =
  <R extends RpcRouterBase>(router: R): RpcServer<R["handlers"]> =>
  (u) =>
    Do(($) => {
      const request = $(requestDecoder.decode(u))
      const codec = $(
        TSE.fromNullable(
          router.codecs[request.method],
          (): RpcNotFound => ({
            _tag: "RpcNotFound",
            method: request.method,
          }),
        ),
      )
      const handler = $(
        TSE.fromNullable(
          router.handlers[request.method],
          (): RpcNotFound => ({
            _tag: "RpcNotFound",
            method: request.method,
          }),
        ),
      )

      const input = $(
        !Effect.isEffect(handler) && "input" in codec
          ? (codec.input as Decoder<any>).decode(request.input)
          : TSE.right(null),
      )

      const effect: Effect<any, any, any> = Effect.isEffect(handler)
        ? handler
        : handler(input as never)

      return effect
        .map((a) => TSE.right(codec.output.encode(a as never)))
        .catchAll((e) =>
          Effect.succeed(TSE.left(codec.error.encode(e as never))),
        )
    }).fold(
      (e) =>
        Effect.succeed(
          responseEncoder.encode(TSE.left(errorEncoder.encode(e))),
        ),
      (a) => a,
    ) as any

export interface UndecodedRpcResponse<M> {
  __rpc: M
}

export type RpcUndecodedClient<H extends RpcHandlers> = {
  [K in keyof H]: H[K] extends RpcDefinitionIO<infer R, infer E, infer I, any>
    ? (input: I) => Effect<R, E, UndecodedRpcResponse<K>>
    : H[K] extends Effect<infer R, infer E, any>
    ? Effect<R, E, UndecodedRpcResponse<K>>
    : never
}

export const makeUndecodedClient = <
  C extends RpcHandlerCodecs,
  H extends RpcHandlersFromCodecs<C>,
>(
  codecs: C,
  handlers: H,
) =>
  Object.entries(handlers as RpcHandlers).reduce<RpcUndecodedClient<H>>(
    (acc, [method, definition]) => {
      const codec = codecs[method]
      return {
        ...acc,
        [method]: Effect.isEffect(definition)
          ? definition.map(codec.output.encode as any)
          : (input) => definition(input).map(codec.output.encode as any),
      }
    },
    {} as any,
  )
