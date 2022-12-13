import * as Codec from "@fp-ts/schema/Codec"

export type ProcedureDefinition<E, I, O> = readonly [
  inputCodec: Codec.Codec<I>,
  outputCodec: Codec.Codec<O>,
  errorCodec: Codec.Codec<E>,
]

export interface RpcSchema {
  [name: string]:
    | ProcedureDefinition<any, any, any>
    | ProcedureDefinition<never, any, any>
}

export const schema = <R extends RpcSchema>(definitions: R) => definitions

export const none: Codec.Codec<void> = Codec.any

export const rpc = <E, I, O>({
  input,
  output,
  error,
}: {
  output: Codec.Codec<O>
  input: Codec.Codec<I>
  error: Codec.Codec<E>
}): ProcedureDefinition<E, I, O> => [input, output, error]
