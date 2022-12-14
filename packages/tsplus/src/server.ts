import * as TSE from "@tsplus/stdlib/data/Either"
import {
  RpcServerError,
  RpcNotFound,
  RpcRequest,
  RpcResponse,
} from "./shared.js"

/**
 * @tsplus type RpcDefinition
 */
export type RpcDefinition<R, E, I, O> =
  | RpcDefinitionIO<R, E, I, O>
  | Effect<R, E, O>

/**
 * @tsplus type RpcDefinitionIO
 */
export type RpcDefinitionIO<R, E, I, O> = (input: I) => Effect<R, E, O>

/**
 * @tsplus type RpcHandlerCodecNoInput
 */
export interface RpcHandlerCodecNoInput<E, O> {
  output: Encoder<O>
  error: Encoder<E>
}

/**
 * @tsplus type RpcHandlerCodecWithInput
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
  | RpcHandlerCodec<any, never, any>

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

/**
 * @tsplus derive RpcHandlerCodecWithInput<_, _, _> 10
 */
export const deriveRpcHandlerCodecWithInput = <E, I, O>(
  ...[input, output, error]: [
    input: Decoder<I>,
    output: Encoder<O>,
    error: Encoder<E>,
  ]
): RpcHandlerCodecWithInput<E, I, O> => {
  return {
    input,
    output,
    error,
  }
}

/**
 * @tsplus derive RpcHandlerCodecNoInput<_, _> 10
 */
export const deriveRpcHandlerCodecNoInput = <E, O>(
  ...[output, error]: [output: Encoder<O>, error: Encoder<E>]
): RpcHandlerCodecNoInput<E, O> => {
  return {
    output,
    error,
  }
}

export interface RpcHandler<D extends RpcDefinition<any, any, any, any>> {
  definition: D
  codec: RpcHandlerCodecFromDefinition<D>
}

export const rpc = <
  C extends RpcHandlerCodec<any, any, any>,
  D extends RpcDefinitionFromCodec<C>,
>(
  _: C,
  definition: D,
) => definition

export interface RpcHandlerCodecs extends Record<string, RpcHandlerCodecAny> {}

export interface RpcHandlers
  extends Record<string, RpcDefinition<any, any, any, any>> {}

export type RpcHandlersFromCodecs<S extends RpcHandlerCodecs> = {
  [K in keyof S]: RpcDefinitionFromCodec<S[K]>
}

type RpcCodecsFromHandlers<H extends RpcHandlers> = {
  [K in keyof H]: H[K] extends Effect<any, infer E, infer O>
    ? RpcHandlerCodecNoInput<E, O>
    : H[K] extends RpcDefinitionIO<any, infer E, infer I, infer O>
    ? RpcHandlerCodecWithInput<E, I, O>
    : never
}

export type RpcHandlersDeps<H extends RpcHandlers> =
  H[keyof H] extends RpcDefinition<infer Deps, any, any, any> ? Deps : never

export type RpcHandlersE<H extends RpcHandlers> =
  H[keyof H] extends RpcDefinition<any, infer E, any, any> ? E : never

export interface RpcRouter<H extends RpcHandlers> {
  readonly handlers: H
  readonly codecs: RpcCodecsFromHandlers<H>
}
export const router = <H extends RpcHandlers>(
  handlers: H,
  codecs: RpcCodecsFromHandlers<H>,
): RpcRouter<H> => ({
  handlers,
  codecs,
})

const requestDecoder = Derive<Decoder<RpcRequest>>()
const responseEncoder = Derive<Encoder<RpcResponse>>()
const errorEncoder = Derive<Encoder<RpcServerError>>()

type RpcServer<H extends RpcHandlers> = (
  u: unknown,
) => Effect<RpcHandlersDeps<H>, RpcHandlersE<H> | RpcServerError, unknown>

type RpcServerFromRouter<R extends RpcRouter<any>> = R extends RpcRouter<
  infer H
>
  ? RpcServer<H>
  : never

export const make =
  <R extends RpcHandlerCodecs, H extends RpcHandlersFromCodecs<R>>(
    schema: R,
    handlers: H,
  ): RpcServer<H> =>
  (u) =>
    Do(($) => {
      const request = $(requestDecoder.decode(u))
      const codec = $(
        TSE.fromNullable(
          schema[request.method],
          (): RpcNotFound => ({
            _tag: "RpcNotFound",
            method: request.method,
          }),
        ),
      )
      const handler = $(
        TSE.fromNullable(
          handlers[request.method],
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
        .map((a) => TSE.right(codec.output.encode(a)))
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

export const makeFromRouter = <R extends RpcRouter<any>>(
  router: R,
): RpcServerFromRouter<R> => make(router.codecs, router.handlers) as any
