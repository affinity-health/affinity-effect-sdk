import { describe, expect, test } from "bun:test";
import { AgentPolicyError, createCodeSession } from "../src/code/client.ts";
import { operationRegistry } from "../src/code/registry.ts";

describe("agent code client", () => {
  test("Live credential inference blocks HTTP writes until confirmed", async () => {
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        requests += 1;
        return Response.json({ detail: "Synthetic missing practice" }, { status: 404 });
      },
    });
    const options = {
      apiKey: "sk_live_synthetic",
      apiBaseUrl: server.url.origin,
      allowMutations: true,
    };
    const blocked = createCodeSession(options);
    const confirmed = createCodeSession({ ...options, confirmLive: true });
    try {
      expect(blocked.mode).toBe("live");
      await expect(
        blocked.affinity.createPracticeLocation({
          practiceId: "prac_synthetic",
          name: "Synthetic",
        }),
      ).rejects.toBeInstanceOf(AgentPolicyError);
      expect(requests).toBe(0);
      await expect(
        confirmed.affinity.createPracticeLocation({
          practiceId: "prac_synthetic",
          name: "Synthetic",
        }),
      ).rejects.toThrow();
      expect(requests).toBe(1);
      expect(() => createCodeSession({ ...options, mode: "test" })).toThrow("mode was requested");
      expect(() => createCodeSession({ ...options, apiKey: "unknown", mode: "test" })).toThrow(
        "Cannot determine",
      );
      expect(requests).toBe(1);
    } finally {
      await blocked.dispose();
      await confirmed.dispose();
      server.stop(true);
    }
  });
  test("sends stable idempotency keys through retries and honors explicit replay keys", async () => {
    const requests: Array<{ key: string | null; body: unknown }> = [];
    let rejectFirst = true;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const key = request.headers.get("Idempotency-Key");
        requests.push({ key, body: await request.json() });
        if (!key) return Response.json({ detail: "Idempotency-Key required" }, { status: 400 });
        if (rejectFirst) {
          rejectFirst = false;
          return Response.json({ detail: "Try again" }, { status: 503 });
        }
        return Response.json({ orderId: "ord_synthetic", status: "submitted" }, { status: 202 });
      },
    });
    const session = createCodeSession({
      apiKey: "sk_test_synthetic",
      apiBaseUrl: server.url.origin,
      allowMutations: true,
      allowClinical: true,
    });
    const input = { orderId: "ord_synthetic", practiceId: "prac_synthetic" };
    try {
      const submitted = await session.affinity.submitOrder(input);
      expect(submitted).toMatchObject({ status: "submitted" });
      await session.affinity.submitOrder(input);
      await session.affinity.submitOrder({ ...input, idempotencyKey: "retry-known-operation" });
      await session.affinity.submitOrder({ ...input, idempotencyKey: "retry-known-operation" });
      expect(requests).toHaveLength(5);
      expect(requests[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
      expect(requests[0]!.key).toBe(requests[1]!.key);
      expect(requests[2]!.key).not.toBe(requests[0]!.key);
      expect(requests[3]!.key).toBe("retry-known-operation");
      expect(requests[4]!.key).toBe("retry-known-operation");
      for (const request of requests)
        expect(request.body).toEqual({ practiceId: input.practiceId });
    } finally {
      await session.dispose();
      server.stop(true);
    }
  });

  test("generates a registry for every OpenAPI operation", () => {
    expect(Object.keys(operationRegistry)).toHaveLength(83);
    expect(operationRegistry.previewOrder.kind).toBe("write");
    expect(operationRegistry.registerUser.kind).toBe("write");
    expect(operationRegistry.getAccount.kind).toBe("read");
    expect(operationRegistry.createPractice.kind).toBe("write");
    expect(operationRegistry.createOrder.kind).toBe("clinical");
    expect(operationRegistry.signOrder.kind).toBe("clinical");
    expect(operationRegistry.submitOrder.kind).toBe("clinical");
    expect(operationRegistry.signAndSubmitOrder.kind).toBe("clinical");
    expect(operationRegistry.addOrderPrescription.kind).toBe("clinical");
  });

  test("blocks mutations unless the session enables them", async () => {
    const session = createCodeSession({ apiKey: "sk_test_synthetic" });
    try {
      await expect(session.affinity.createPractice({} as never)).rejects.toBeInstanceOf(
        AgentPolicyError,
      );
    } finally {
      await session.dispose();
    }
  });

  test("requires separate clinical access", async () => {
    const session = createCodeSession({
      apiKey: "sk_test_synthetic",
      allowMutations: true,
    });
    try {
      await expect(session.affinity.createOrder({} as never)).rejects.toMatchObject({
        _tag: "AgentPolicyError",
        kind: "clinical",
        operation: "createOrder",
      });
    } finally {
      await session.dispose();
    }
  });

  test("requires exact confirmation for Live mutations", async () => {
    const session = createCodeSession({
      apiKey: "sk_live_synthetic",
      allowMutations: true,
      mode: "live",
    });
    try {
      await expect(session.affinity.createPractice({} as never)).rejects.toMatchObject({
        _tag: "AgentPolicyError",
        operation: "createPractice",
      });
    } finally {
      await session.dispose();
    }
  });
});
