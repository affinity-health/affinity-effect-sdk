# Affinity Effect SDK

Effect-native TypeScript client for the Affinity API. It generates typed operations and runtime schemas from Affinity's OpenAPI document.

This package is an early local prototype. It has not been published to npm.

## Install

```sh
bun add @affinity-health/effect-sdk effect@rc
```

## Use it in code mode

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

console.log(patient);
```

Operations return `Effect` values with typed success, failure, and service requirements. The package exports all 46 operations at its root and under `Operations`.

## Configuration

`layer` accepts:

- `apiKey`, required
- `apiBaseUrl`, defaulting to `https://api.joinaffinityai.com`
- `apiVersion`, defaulting to `2026-08-11`
- `actor`, an optional provider or user attribution

Use `fromEnv` when a larger application already provides its HTTP client. It reads `AFFINITY_API_KEY`, `AFFINITY_API_BASE_URL`, and `AFFINITY_API_VERSION`.

The SDK has no telemetry. It supports any runtime with `fetch`, including Bun, Node.js 20 or newer, browsers, and workers. Service API keys must stay in trusted server-side code.

## Regenerate

The repository commits the official Affinity OpenAPI document and generated TypeScript. Run:

```sh
bun run generate
bun run check
```

Generation uses Distilled's OpenAPI to Smithy converter and Effect SDK generator. Do not edit `src/services` by hand.
