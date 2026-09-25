# Affinity Effect SDK

Effect-native TypeScript SDK and local code runner for the Affinity API. The repository generates 81 typed operations and runtime schemas: 72 public operations from the pinned API contract and the 9 existing internal pricing and formulation operations.

## Install

```sh
bun add @affinity-health/effect-sdk effect@4.0.0-rc.112
```

Set the API key in the process environment. The CLI never accepts secrets as flags.

```sh
affinity auth login
# Request read and write access.
affinity auth login --access write
```

The CLI opens Affinity's browser approval page, polls using OAuth device authorization, and stores
the resulting expiring credential in the user's configuration directory with owner-only
permissions. Inspect or revoke it without exposing the token:

```sh
affinity auth status --json
affinity auth logout
```

A device login can authorize one or more organizations. Select an organization for each command:

```sh
affinity context --json
affinity eval 'await affinity.getAccount({})' --organization org_example
```

When the login contains one organization, the CLI selects it automatically. For repeated work,
set `AFFINITY_ORGANIZATION_ID`. The API rejects an organization that was not approved during
device login.

`AFFINITY_API_KEY` remains available as an explicit environment override for non-interactive
automation. Never pass a credential as a command argument.

Give an agent the complete operating contract before it acts:

```sh
affinity context
affinity context --json
```

The text form is a concise briefing. The JSON form also includes the generated operation catalog,
policy classes, clinical invariants, authentication status, and the default budget of 100 API
requests with a 30-second timeout per request. It does not require credentials.

## Agent code mode

Evaluate one asynchronous JavaScript expression:

```sh
affinity eval 'await affinity.getAccount({})'
```

List every callable operation without making a request:

```sh
affinity operations
affinity operations --json
```

Pipe an expression over stdin and get compact JSON:

```sh
printf 'await affinity.listPractices({ limit: 10 })' | affinity eval - --json
```

For longer programs, default-export an `AgentProgram` from a TypeScript or JavaScript module:

```ts
import type { AgentProgram } from "@affinity-health/effect-sdk/code";

const program: AgentProgram = async ({ affinity, log }) => {
  log("Reading the first ten practices");
  return affinity.listPractices({ limit: 10 });
};

export default program;
```

Run it with Bun:

```sh
affinity run program.ts --json
```

The runner puts the program's result on stdout. `log(...)`, diagnostics, and errors go to stderr, so agents can parse stdout without removing status messages.

### Mutation policy

Code sessions are read-only by default. Test-mode mutations require `--apply`:

```sh
affinity run setup-practice.ts --apply
```

Order creation, cancellation, and signing-session operations also require `--allow-clinical`. Test mode must use synthetic patient and prescription data.

Live mutations require an exact second confirmation:

```sh
affinity run update-practice.ts \
  --mode live \
  --apply \
  --confirm-live LIVE
```

The runner derives Test or Live mode from the API key. If supplied, `--mode` or `AFFINITY_MODE` must match that key. Live mutations require `--confirm-live LIVE` even when the mode flag is omitted. The server enforces authorization and data isolation.

The public contract includes `previewOrder`, `createOrder`, `signOrder`, `submitOrder`, and
`signAndSubmitOrder`. Creation uses one patient and a `prescriptions` array. Use
`--apply --allow-clinical` for order mutations. Fetch current versions and obtain the clinician's
attestation before signing. See the [headless workflow](https://docs.joinaffinityai.com/guides/choose-an-integration/).

The CLI and code client generate a separate idempotency key for each mutation and keep it through automatic retries. To replay an operation across calls or process restarts, supply the same `idempotencyKey` in its input. Effect-native operations require that input explicitly where the API requires it.

Each session permits 100 operations by default, with a 30-second timeout per operation. Use `--max-requests` and `--timeout` to lower or raise those limits.

The runner executes local code with the current operating-system user's permissions. It is not a sandbox. Run only code you trust. The runner removes `AFFINITY_API_KEY` from its process environment before evaluating agent code, but the injected `affinity` client remains authorized for the operations allowed by the session policy.

## Await-friendly library

Applications can create the same client without the CLI:

```ts
import { createCodeSession } from "@affinity-health/effect-sdk/code";

const session = createCodeSession({
  apiKey: process.env.AFFINITY_API_KEY!,
  mode: "test",
  organizationId: "org_example",
});

try {
  const account = await session.affinity.getAccount({});
  console.log(account);
} finally {
  await session.dispose();
}
```

Use `createCodeSession` for bounded work because it exposes `dispose()`. `createClient` is available for process-lifetime clients.

## Raw Effect operations

The package root exports the generated Effect operations directly:

```ts
import { Effect } from "effect";
import { layer, updatePatient } from "@affinity-health/effect-sdk";

const program = updatePatient({
  practiceId: "prac_example",
  patientId: "pat_example",
  name: {
    first: "Jane",
    last: "Doe",
  },
});

const patient = await Effect.runPromise(
  program.pipe(
    Effect.provide(
      layer({
        apiKey: process.env.AFFINITY_API_KEY!,
      }),
    ),
  ),
);
```

Operations have typed success, failure, and service requirements. Credentials resolve for each request, and service keys stay redacted inside the Effect configuration.

## Configuration

The library accepts:

- `apiKey`, required
- `apiBaseUrl`, defaulting to `https://api.joinaffinityai.com`
- `apiVersion`, defaulting to `2026-08-11`
- `actor`, an optional provider or user attribution

The CLI reads `AFFINITY_API_KEY`, `AFFINITY_API_BASE_URL`, `AFFINITY_API_VERSION`, `AFFINITY_ACTOR_ID`, `AFFINITY_ACTOR_TYPE`, and `AFFINITY_MODE`. Invocation flags take precedence over environment defaults for non-secret settings.

The SDK has no telemetry. The library supports runtimes with `fetch`, including Bun, Node.js 20 or newer, browsers, and workers. The CLI requires Bun. Service API keys must stay in trusted server-side code.

## Regenerate

The repository commits the official Affinity OpenAPI document and generated TypeScript:

```sh
bun run generate
bun run check
```

Generation uses Distilled's OpenAPI-to-Smithy converter and Effect SDK generator. It also builds the agent operation registry from the same OpenAPI paths. Do not edit `src/services` or `src/code/registry.ts` by hand.
