#!/usr/bin/env bun

import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Option, Predicate, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import {
  AgentOperationError,
  AgentPolicyError,
  createCodeSession,
  type AffinityCodeSession,
  type AgentProgram,
  type AgentProgramContext,
} from "./code/index.ts";
import { operationRegistry } from "./code/registry.ts";

const VERSION = "0.1.0";

class CliError extends Schema.TaggedError<CliError>()("CliError", {
  cause: Schema.optional(Schema.Unknown),
  exitCode: Schema.Int,
  message: Schema.String,
}) {}

const modeDefault = process.env.AFFINITY_MODE === "live" ? "live" : "test";

const affinity = Command.make("affinity").pipe(
  Command.withDescription("Run agent-authored code against the Affinity API"),
  Command.withSharedFlags({
    allowClinical: Flag.boolean("allow-clinical").pipe(
      Flag.withDescription("Allow order and signing-session operations"),
      Flag.withDefault(false),
    ),
    apply: Flag.boolean("apply").pipe(
      Flag.withDescription("Allow operations that change state"),
      Flag.withDefault(false),
    ),
    confirmLive: Flag.string("confirm-live").pipe(
      Flag.withDescription('Confirm Live mutations with the exact value "LIVE"'),
      Flag.optional,
    ),
    json: Flag.boolean("json").pipe(
      Flag.withDescription("Print compact machine-readable JSON"),
      Flag.withDefault(false),
    ),
    maxRequests: Flag.integer("max-requests").pipe(
      Flag.withDescription("Maximum API operations in one code session"),
      Flag.withDefault(100),
    ),
    mode: Flag.choice("mode", ["test", "live"]).pipe(
      Flag.withDescription("Policy mode for this execution"),
      Flag.withDefault(modeDefault),
    ),
    timeout: Flag.integer("timeout").pipe(
      Flag.withDescription("Timeout for each API operation in milliseconds"),
      Flag.withDefault(30_000),
    ),
    verbose: Flag.boolean("verbose").pipe(
      Flag.withDescription("Print operation diagnostics to stderr"),
      Flag.withDefault(false),
    ),
  }),
);

interface RootOptions {
  readonly allowClinical: boolean;
  readonly apply: boolean;
  readonly confirmLive: Option.Option<string>;
  readonly json: boolean;
  readonly maxRequests: number;
  readonly mode: "test" | "live";
  readonly timeout: number;
  readonly verbose: boolean;
}

const serialize = (value: unknown, compact: boolean): string =>
  JSON.stringify(
    value === undefined ? null : value,
    (_key, item: unknown) => {
      if (typeof item === "bigint") return item.toString();
      if (item instanceof Error) {
        const serialized =
          "toJSON" in item && Predicate.isFunction(item.toJSON)
            ? item.toJSON()
            : { message: item.message, name: item.name };
        return serialized;
      }
      return item;
    },
    compact ? undefined : 2,
  );

const printValue = (value: unknown, compact: boolean) => Console.log(serialize(value, compact));

const loadSession = Effect.fn("loadSession")(function* (root: RootOptions) {
  const apiKey = process.env.AFFINITY_API_KEY;
  if (!apiKey) {
    return yield* new CliError({
      exitCode: 3,
      message: "AFFINITY_API_KEY is required in the process environment",
    });
  }

  const actorId = process.env.AFFINITY_ACTOR_ID;
  const actorType = process.env.AFFINITY_ACTOR_TYPE;
  if ((actorId && !actorType) || (!actorId && actorType)) {
    return yield* new CliError({
      exitCode: 2,
      message: "AFFINITY_ACTOR_ID and AFFINITY_ACTOR_TYPE must be set together",
    });
  }
  if (actorType && actorType !== "provider" && actorType !== "user") {
    return yield* new CliError({
      exitCode: 2,
      message: 'AFFINITY_ACTOR_TYPE must be "provider" or "user"',
    });
  }

  const session = yield* Effect.try({
    try: () =>
      createCodeSession({
        apiKey,
        apiBaseUrl: process.env.AFFINITY_API_BASE_URL,
        apiVersion: process.env.AFFINITY_API_VERSION,
        actor:
          actorId && actorType
            ? { id: actorId, type: actorType as "provider" | "user" }
            : undefined,
        allowClinical: root.allowClinical,
        allowMutations: root.apply,
        confirmLive: Option.getOrUndefined(root.confirmLive) === "LIVE",
        maxRequests: root.maxRequests,
        mode: root.mode,
        timeoutMs: root.timeout,
        onOperation: root.verbose
          ? (event) => {
              console.error(
                `[${event.requestNumber}] ${event.kind} ${event.name} ${event.method} ${event.path}`,
              );
            }
          : undefined,
      }),
    catch: (cause) =>
      new CliError({
        cause,
        exitCode: 2,
        message: cause instanceof Error ? cause.message : "Invalid code-session configuration",
      }),
  });

  delete process.env.AFFINITY_API_KEY;
  return session;
});

const withSession = <A>(
  root: RootOptions,
  use: (session: AffinityCodeSession) => Effect.Effect<A, CliError>,
) =>
  Effect.acquireUseRelease(loadSession(root), use, (session) =>
    Effect.promise(() => session.dispose()),
  );

const agentLog = (...values: ReadonlyArray<unknown>): void => {
  console.error(...values);
};

const evaluate = Effect.fn("evaluate")(function* (source: string, context: AgentProgramContext) {
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
    ...parameters: Array<string>
  ) => (...args: Array<unknown>) => Promise<unknown>;

  return yield* Effect.tryPromise({
    try: () =>
      new AsyncFunction("affinity", "operations", "log", `"use strict"; return (${source});`)(
        context.affinity,
        context.operations,
        context.log,
      ),
    catch: (cause) =>
      new CliError({
        cause,
        exitCode: 1,
        message: cause instanceof Error ? cause.message : "Code evaluation failed",
      }),
  });
});

const evalCommand = Command.make(
  "eval",
  {
    expression: Argument.string("expression").pipe(
      Argument.withDescription('JavaScript expression, or "-" to read stdin'),
    ),
  },
  Effect.fn("affinity.eval")(function* ({ expression }) {
    const root = yield* affinity;
    const source =
      expression === "-"
        ? yield* Effect.tryPromise({
            try: () => Bun.stdin.text(),
            catch: (cause) =>
              new CliError({ cause, exitCode: 1, message: "Could not read code from stdin" }),
          })
        : expression;

    return yield* withSession(root, (session) =>
      evaluate(source, {
        affinity: session.affinity,
        log: agentLog,
        operations: session.operations,
      }).pipe(Effect.flatMap((value) => printValue(value, root.json))),
    );
  }),
).pipe(
  Command.withDescription("Evaluate one async expression with an authenticated client"),
  Command.withExamples([
    {
      command: 'affinity eval "await affinity.getAccount({})"',
      description: "Read the authenticated account",
    },
    {
      command: "printf 'await affinity.listPractices({ limit: 10 })' | affinity eval - --json",
      description: "Read an expression from stdin and print compact JSON",
    },
  ]),
);

const runCommand = Command.make(
  "run",
  {
    file: Argument.string("file").pipe(
      Argument.withDescription("Bun TypeScript or JavaScript module to execute"),
    ),
  },
  Effect.fn("affinity.run")(function* ({ file }) {
    const root = yield* affinity;
    return yield* withSession(root, (session) =>
      Effect.tryPromise({
        try: async () => {
          const url = pathToFileURL(path.resolve(file));
          url.searchParams.set("affinity_run", String(Date.now()));
          const module: unknown = await import(url.href);
          const program = Predicate.isObject(module) ? module.default : undefined;
          if (!Predicate.isFunction(program)) {
            throw new Error("The program module must default-export a function");
          }
          return (program as AgentProgram)({
            affinity: session.affinity,
            log: agentLog,
            operations: session.operations,
          });
        },
        catch: (cause) =>
          new CliError({
            cause,
            exitCode: 1,
            message: cause instanceof Error ? cause.message : "Program execution failed",
          }),
      }).pipe(Effect.flatMap((value) => printValue(value, root.json))),
    );
  }),
).pipe(
  Command.withDescription("Execute an agent program module with an authenticated client"),
  Command.withExamples([
    {
      command: "affinity run setup-practice.ts --apply",
      description: "Run a Test-mode program that may change state",
    },
  ]),
);

const operationsCommand = Command.make(
  "operations",
  {},
  Effect.fn("affinity.operations")(function* () {
    const root = yield* affinity;
    const operations = Object.entries(operationRegistry).map(([name, operation]) => ({
      kind: operation.kind,
      method: operation.method,
      name,
      path: operation.path,
      summary: operation.summary,
      tag: operation.tag,
    }));

    if (root.json) return yield* printValue(operations, true);
    for (const operation of operations) {
      yield* Console.log(
        `${operation.kind.padEnd(8)} ${operation.name.padEnd(31)} ${operation.method.padEnd(6)} ${operation.path}`,
      );
    }
  }),
).pipe(Command.withDescription("List operations available to agent programs"));

const doctorCommand = Command.make(
  "doctor",
  {},
  Effect.fn("affinity.doctor")(function* () {
    const root = yield* affinity;
    const checks = {
      apiBaseUrl: process.env.AFFINITY_API_BASE_URL ?? "https://api.joinaffinityai.com",
      apiKey: process.env.AFFINITY_API_KEY ? "configured" : "missing",
      apiVersion: process.env.AFFINITY_API_VERSION ?? "2026-08-11",
      bun: Bun.version,
      mode: root.mode,
      mutationAccess: root.apply,
    };
    yield* printValue(checks, root.json);
    if (!process.env.AFFINITY_API_KEY) {
      return yield* new CliError({
        exitCode: 3,
        message: "Set AFFINITY_API_KEY before running agent code",
      });
    }
  }),
).pipe(Command.withDescription("Check the local code-mode configuration without making a request"));

const program = affinity.pipe(
  Command.withSubcommands([doctorCommand, evalCommand, operationsCommand, runCommand]),
  Command.run({ version: VERSION }),
  Effect.provide(BunServices.layer),
  Effect.catch((error) => {
    const json = process.argv.includes("--json");
    const message = error instanceof CliError ? error.message : String(error);
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const cause = error instanceof CliError ? error.cause : error;
    const agentError =
      cause instanceof AgentPolicyError || cause instanceof AgentOperationError ? cause : undefined;
    return Console.error(
      json
        ? serialize(
            {
              error: {
                ...(agentError ? agentError.toJSON() : {}),
                message,
                type: agentError?._tag ?? (error instanceof CliError ? error._tag : "CliFailure"),
              },
            },
            true,
          )
        : `Error: ${message}`,
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          process.exitCode = exitCode;
        }),
      ),
    );
  }),
);

BunRuntime.runMain(program, { disableErrorReporting: true });
