import { ConfigError } from "@distilled.cloud/core/errors";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

export const DEFAULT_API_BASE_URL = "https://api.joinaffinityai.com";
export const DEFAULT_API_VERSION = "2026-08-11";

export interface Actor {
  readonly id: string;
  readonly type: "provider" | "user";
}

export interface Config {
  readonly apiKey: Redacted.Redacted<string>;
  readonly apiBaseUrl: string;
  readonly apiVersion: string;
  readonly actor?: Actor;
}

export interface CredentialsOptions {
  readonly apiKey: string;
  readonly apiBaseUrl?: string;
  readonly apiVersion?: string;
  readonly actor?: Actor;
}

export class Credentials extends Context.Service<Credentials, Effect.Effect<Config, ConfigError>>()(
  "@affinity-health/effect-sdk/Credentials",
) {}

export const fromApiKey = (options: CredentialsOptions): Layer.Layer<Credentials> =>
  Layer.succeed(
    Credentials,
    options.apiKey.trim().length === 0
      ? Effect.fail(
          new ConfigError({
            message: "Affinity requires a non-empty API key",
          }),
        )
      : Effect.succeed({
          apiKey: Redacted.make(options.apiKey),
          apiBaseUrl: (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ""),
          apiVersion: options.apiVersion ?? DEFAULT_API_VERSION,
          actor: options.actor,
        }),
  );

export const fromEnv: Layer.Layer<Credentials> = Layer.succeed(
  Credentials,
  Effect.gen(function* () {
    const apiKey = process.env.AFFINITY_API_KEY;
    if (!apiKey) {
      return yield* new ConfigError({
        message: "AFFINITY_API_KEY environment variable is required",
      });
    }
    return {
      apiKey: Redacted.make(apiKey),
      apiBaseUrl: (process.env.AFFINITY_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ""),
      apiVersion: process.env.AFFINITY_API_VERSION ?? DEFAULT_API_VERSION,
    };
  }),
);
