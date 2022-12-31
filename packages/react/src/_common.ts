import type { Schedule as _Schedule } from "@effect/io/Schedule"

export type { Effect } from "@effect/io/Effect"
export type { Exit } from "@effect/io/Exit"
export type { Scope } from "@effect/io/Scope"
export type { Stream } from "@effect/stream/Stream"
export type { SubscriptionRef } from "@effect/stream/SubscriptionRef"

export type { Either } from "@fp-ts/data/Either"
export type { Option as Maybe } from "@fp-ts/data/Option"
export type { These } from "@fp-ts/data/These"

/**
 * @tsplus type effect/io/Schedule
 * @tsplus companion effect/io/Schedule.Ops
 */
export type Schedule<Env, In, Out> = _Schedule<Env, In, Out>
