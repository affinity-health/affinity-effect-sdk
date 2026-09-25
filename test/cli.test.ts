import { describe, expect, test } from "bun:test";

const cwd = `${import.meta.dir}/..`;

const execute = (
  args: ReadonlyArray<string>,
  environment: Readonly<Record<string, string | undefined>> = {},
) => {
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: `${cwd}/test/fixtures/missing-config`,
    ...environment,
  };
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete env[name];
  }
  const result = Bun.spawnSync(["bun", "src/cli.ts", ...args], {
    cwd,
    env: env as Record<string, string>,
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
};

describe("affinity CLI", () => {
  test("infers Live credentials and rejects mode mismatches without exposing the key", () => {
    const environment = { AFFINITY_API_KEY: "sk_live_synthetic", AFFINITY_MODE: undefined };
    const doctor = execute(["doctor", "--json"], environment);
    expect(doctor.exitCode).toBe(0);
    expect(JSON.parse(doctor.stdout).mode).toBe("live");
    const blocked = execute(
      ["eval", "await affinity.createPractice({})", "--apply", "--json"],
      environment,
    );
    expect(blocked.exitCode).toBe(1);
    expect(JSON.parse(blocked.stderr).error.type).toBe("AgentPolicyError");
    for (const [key, mode] of [
      ["sk_live_synthetic", "test"],
      ["sk_test_synthetic", "live"],
    ]) {
      const mismatch = execute(
        ["eval", "await affinity.createPractice({})", "--apply", "--mode", mode!, "--json"],
        { AFFINITY_API_KEY: key, AFFINITY_MODE: undefined },
      );
      expect(mismatch.exitCode).toBe(2);
      expect(mismatch.stderr).toContain("mode was requested");
      expect(mismatch.stderr).not.toContain(key!);
    }
    expect(doctor.stdout + blocked.stderr).not.toContain(environment.AFFINITY_API_KEY);
  });
  test("prints a deterministic agent context without credentials", () => {
    const result = execute(["context", "--json"], {
      AFFINITY_API_KEY: undefined,
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      authentication: { deviceAuthorization: "rfc8628" },
      execution: { defaults: { maxRequests: 100, operationTimeoutMs: 30_000 } },
      operations: { counts: { total: 81 } },
    });
    expect(result.stderr).toBe("");
  });

  test("lists operations without credentials", () => {
    const result = execute(["operations", "--json"], {
      AFFINITY_API_KEY: undefined,
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveLength(81);
    expect(result.stderr).toBe("");
  });

  test("reports signed-out auth status without exposing a credential path", () => {
    const result = execute(["auth", "status", "--json"], {
      AFFINITY_API_KEY: undefined,
      XDG_CONFIG_HOME: `${cwd}/test/fixtures/missing-config`,
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ source: "none", status: "signed-out" });
    expect(result.stderr).toBe("");
  });

  test("evaluates an expression with the bound agent context", () => {
    const result = execute(["eval", "Object.keys(operations).length", "--json"], {
      AFFINITY_API_KEY: "sk_test_synthetic",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("81\n");
    expect(result.stderr).toBe("");
  });

  test("returns structured policy errors for blocked mutations", () => {
    const result = execute(["eval", "await affinity.createPractice({})", "--json"], {
      AFFINITY_API_KEY: "sk_test_synthetic",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: {
        operation: "createPractice",
        type: "AgentPolicyError",
      },
    });
  });

  test("runs a typed agent program module", () => {
    const result = execute(["run", "test/fixtures/agent-program.ts", "--json"], {
      AFFINITY_API_KEY: "sk_test_synthetic",
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ operationCount: 81 });
    expect(result.stderr).toBe("");
  });

  test("doctor reports a missing API key without exposing secrets", () => {
    const result = execute(["doctor", "--json"], {
      AFFINITY_API_KEY: undefined,
    });
    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({ authentication: "missing", mode: "test" });
    expect(result.stdout).not.toContain("secret");
  });
});
