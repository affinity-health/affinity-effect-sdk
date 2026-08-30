import { describe, expect, test } from "bun:test";
import { Effect, Redacted } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { Credentials, fromApiKey } from "../src/credentials.ts";
import { layer } from "../src/client.ts";
import * as Retry from "../src/retry.ts";
import { getAccount } from "../src/services/affinity.ts";

describe("credentials", () => {
  test("redacts API keys and applies defaults", async () => {
    const config = await Effect.runPromise(
      Effect.gen(function* () {
        const resolve = yield* Credentials;
        return yield* resolve;
      }).pipe(Effect.provide(fromApiKey({ apiKey: "aff_test_secret" }))),
    );

    expect(Redacted.value(config.apiKey)).toBe("aff_test_secret");
    expect(String(config.apiKey)).not.toContain("aff_test_secret");
    expect(config.apiBaseUrl).toBe("https://api.joinaffinityai.com");
    expect(config.apiVersion).toBe("2026-08-11");
  });
});

describe("generated operations", () => {
  test("send Affinity authentication, version, and actor headers", async () => {
    let request: Request | undefined;
    const fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json({ message: "stop after recording the request" }, { status: 418 });
    }) as typeof globalThis.fetch;

    await Effect.runPromise(
      Effect.result(getAccount({}).pipe(Retry.none)).pipe(
        Effect.provide(
          layer({
            apiKey: "aff_test_secret",
            apiBaseUrl: "https://example.test/",
            actor: { id: "usr_test", type: "user" },
          }),
        ),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
      ),
    );

    expect(request?.url).toBe("https://example.test/v1/account");
    expect(request?.headers.get("authorization")).toBe("Bearer aff_test_secret");
    expect(request?.headers.get("affinity-version")).toBe("2026-08-11");
    expect(request?.headers.get("affinity-actor-id")).toBe("usr_test");
    expect(request?.headers.get("affinity-actor-type")).toBe("user");
  });
});
