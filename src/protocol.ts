import type * as API from "@distilled.cloud/core/api";
import type { ConfigError } from "@distilled.cloud/core/errors";
import { makeRestProtocol } from "@distilled.cloud/core/protocol-rest";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import { Credentials, type Config } from "./credentials.ts";
import { UnknownAffinityError, type DefaultErrors } from "./errors.ts";

export type AffinityOpError = DefaultErrors | ConfigError | HttpClientError.HttpClientError;

export type AffinityOpContext = Credentials | HttpClient.HttpClient;

export const AffinityProtocol: Layer.Layer<API.Protocol> = makeRestProtocol<Config>({
  credentials: Effect.gen(function* () {
    const resolve = yield* Credentials;
    return yield* resolve;
  }),
  baseUrl: (config) => config.apiBaseUrl,
  headers: (config) => ({
    Authorization: `Bearer ${Redacted.value(config.apiKey)}`,
    "Affinity-Version": config.apiVersion,
    ...(config.organizationId ? { "X-Affinity-Organization-Id": config.organizationId } : {}),
    ...(config.actor
      ? {
          "Affinity-Actor-Id": config.actor.id,
          "Affinity-Actor-Type": config.actor.type,
        }
      : {}),
  }),
  unknownError: ({ code, message, body }) =>
    new UnknownAffinityError({
      code: typeof code === "string" ? code : code === undefined ? undefined : String(code),
      message,
      body,
    }),
});
