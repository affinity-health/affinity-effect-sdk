import { describe, expect, test } from "bun:test";
import { AgentPolicyError, createCodeSession } from "../src/code/client.ts";
import { operationRegistry } from "../src/code/registry.ts";

describe("agent code client", () => {
  test("generates a registry for every OpenAPI operation", () => {
    expect(Object.keys(operationRegistry)).toHaveLength(46);
    expect(operationRegistry.getAccount.kind).toBe("read");
    expect(operationRegistry.createPractice.kind).toBe("write");
    expect(operationRegistry.createOrders.kind).toBe("clinical");
  });

  test("blocks mutations unless the session enables them", async () => {
    const session = createCodeSession({ apiKey: "aff_test_secret" });
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
      apiKey: "aff_test_secret",
      allowMutations: true,
    });
    try {
      await expect(session.affinity.createOrders({} as never)).rejects.toMatchObject({
        _tag: "AgentPolicyError",
        kind: "clinical",
        operation: "createOrders",
      });
    } finally {
      await session.dispose();
    }
  });

  test("requires exact confirmation for Live mutations", async () => {
    const session = createCodeSession({
      apiKey: "aff_live_secret",
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
