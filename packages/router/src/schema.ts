import * as Codec from "@fp-ts/schema/Codec"

export type ProcedureDefinition<E, I, O> = readonly [
  inputCodec: Codec.Codec<I>,
  outputCodec: Codec.Codec<O>,
  errorCodec: Codec.Codec<E>,
]

export type ProcedureInput<
  R extends RpcSchema,
  N extends keyof R,
> = R[N] extends ProcedureDefinition<any, infer I, any> ? I : never

export type ProcedureError<
  R extends RpcSchema,
  N extends keyof R,
> = R[N] extends ProcedureDefinition<infer E, any, any> ? E : never

export type ProcedureOutput<
  R extends RpcSchema,
  N extends keyof R,
> = R[N] extends ProcedureDefinition<any, any, infer O> ? O : never

export interface RpcSchema {
  [name: string]:
    | ProcedureDefinition<any, any, any>
    | ProcedureDefinition<never, any, any>
}

export const schema = <R extends RpcSchema>(definitions: R) => definitions

export const rpc = <E, I, O>({
  input,
  output,
  error,
}: {
  input: Codec.Codec<I>
  output: Codec.Codec<O>
  error: Codec.Codec<E>
}): ProcedureDefinition<E, I, O> => [input, output, error]
