import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type Policy, throttlingFactory, transientFactory } from "@distilled.cloud/core/retry";

export * from "@distilled.cloud/core/retry";

export class Retry extends Context.Service<Retry, Policy>()("@affinity-health/effect-sdk/Retry") {}

export const policy = (retryPolicy: Policy) => Effect.provide(Layer.succeed(Retry, retryPolicy));

export const none = Effect.provide(Layer.succeed(Retry, { while: () => false }));
export const throttling = policy(throttlingFactory);
export const transient = policy(transientFactory);
