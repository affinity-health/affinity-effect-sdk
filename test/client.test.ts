import { describe, expect, test } from "bun:test";
import { Effect, Redacted } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { Credentials, fromApiKey } from "../src/credentials.ts";
import { layer } from "../src/client.ts";
import * as Retry from "../src/retry.ts";
import { createOrder, getAccount, signOrder, submitOrder } from "../src/services/affinity.ts";

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
  test("serializes current draft, NPI signing, and inherited-prescriber submission requests", async () => {
    const requests: Request[] = [];
    const fetch = (async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({ message: "recorded" }, { status: 418 });
    }) as typeof globalThis.fetch;
    const prescription = {
      daysSupply: 30,
      dispensing: { shippingDestinationType: "patient" as const },
      directions: "Take one tablet daily.",
      medicationId: "cat_synthetic",
      quantity: 30,
      quantityUnit: "tablet",
      refills: 0,
    };
    const draft = {
      practiceId: "prac_synthetic",
      patientId: "pat_synthetic",
      prescriber: { npi: "1111111112" },
      prescriptions: [prescription],
    };
    const signing = {
      practiceId: draft.practiceId,
      prescriber: draft.prescriber,
      signatureAttestation: true,
      expectedVersions: [{ prescriptionId: "rx_synthetic", version: 1 }],
    };
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.result(createOrder(draft).pipe(Retry.none));
        yield* Effect.result(signOrder({ orderId: "ord_synthetic", ...signing }).pipe(Retry.none));
        yield* Effect.result(
          submitOrder({ orderId: "ord_synthetic", practiceId: draft.practiceId }).pipe(Retry.none),
        );
      }).pipe(
        Effect.provide(layer({ apiKey: "aff_test_secret", apiBaseUrl: "https://example.test" })),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
      ),
    );
    expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ["POST", "/v1/orders"],
      ["POST", "/v1/orders/ord_synthetic/sign"],
      ["POST", "/v1/orders/ord_synthetic/submit"],
    ]);
    expect(await Promise.all(requests.map((request) => request.json()))).toEqual([
      draft,
      signing,
      { practiceId: draft.practiceId },
    ]);
  });

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
