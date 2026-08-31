import { DEFAULT_API_BASE_URL, DEFAULT_API_VERSION } from "./credentials.ts";
import { operationRegistry } from "./code/registry.ts";

export const DEFAULT_MAX_REQUESTS = 100;
export const DEFAULT_OPERATION_TIMEOUT_MS = 30_000;

const operations = Object.entries(operationRegistry).map(([name, operation]) => ({
  kind: operation.kind,
  method: operation.method,
  name,
  path: operation.path,
  summary: operation.summary,
  tag: operation.tag,
}));

const operationCounts = operations.reduce(
  (counts, operation) => {
    counts[operation.kind] += 1;
    return counts;
  },
  { clinical: 0, read: 0, write: 0 },
);

export const affinityAgentContext = {
  identity: {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    apiVersion: DEFAULT_API_VERSION,
    package: "@affinity-health/effect-sdk",
    purpose: "Manage Affinity platform resources through typed, policy-guarded agent code.",
  },
  execution: {
    commands: {
      context: "affinity context --json",
      expression: 'affinity eval "await affinity.getAccount({})" --json',
      file: "affinity run program.ts --json",
      operations: "affinity operations --json",
    },
    defaults: {
      maxRequests: DEFAULT_MAX_REQUESTS,
      mode: "test",
      operationTimeoutMs: DEFAULT_OPERATION_TIMEOUT_MS,
    },
    output: {
      diagnostics: "stderr",
      result: "stdout",
      structured: "Pass --json for compact, stable JSON.",
    },
  },
  authentication: {
    commands: {
      login: "affinity auth login (read-only) or affinity auth login --access write",
      logout: "affinity auth logout",
      status: "affinity auth status --json",
    },
    current: "Saved device login, with AFFINITY_API_KEY as an explicit environment override",
    deviceAuthorization: "rfc8628",
    guidance:
      "Never place credentials in arguments, source files, logs, or agent prompts. Device credentials are stored in the user configuration directory with owner-only permissions.",
  },
  policy: {
    clinical: "Order and signing operations additionally require --allow-clinical.",
    live: "Live mutations additionally require --mode live --confirm-live LIVE.",
    mutations: "Sessions are read-only unless --apply is present.",
    runner:
      "Agent programs execute with the local operating-system user's permissions; code mode is not a sandbox.",
  },
  clinicalSafety: [
    "Use one patient, one practice, and one prescribing provider per order.",
    "An order contains 1–20 independently complete prescriptions for the same patient.",
    "API-created prescriptions are unsigned drafts; only the attributed provider reviews and signs the immutable batch in Affinity.",
    "Do not infer diagnosis, clinical rationale, authorization evidence, or provider intent.",
    "Treat Test mode as synthetic data and simulator traffic only.",
    "Controlled substances fail closed while EPCS is outside the release.",
  ],
  operations: {
    counts: { ...operationCounts, total: operations.length },
    catalog: operations,
  },
} as const;

export const renderAffinityAgentContext = (): string => {
  const { authentication, clinicalSafety, execution, identity, operations, policy } =
    affinityAgentContext;
  return [
    "# Affinity agent context",
    "",
    identity.purpose,
    "",
    "## Start here",
    "",
    `- Inspect operations: \`${execution.commands.operations}\``,
    `- Evaluate one expression: \`${execution.commands.expression}\``,
    `- Run a typed program: \`${execution.commands.file}\``,
    `- API: ${identity.apiBaseUrl} (contract ${identity.apiVersion})`,
    "",
    "## Session limits",
    "",
    `- ${execution.defaults.maxRequests} API requests per invocation`,
    `- ${execution.defaults.operationTimeoutMs / 1_000} seconds per API request`,
    `- ${operations.counts.total} operations: ${operations.counts.read} read, ${operations.counts.write} write, ${operations.counts.clinical} clinical`,
    "",
    "## Authorization and safety",
    "",
    `- ${policy.mutations}`,
    `- ${policy.clinical}`,
    `- ${policy.live}`,
    `- ${policy.runner}`,
    `- Current credential source: ${authentication.current}. ${authentication.guidance}`,
    "",
    "## Clinical invariants",
    "",
    ...clinicalSafety.map((item) => `- ${item}`),
    "",
    "## I/O contract",
    "",
    `- Results: ${execution.output.result}`,
    `- Diagnostics: ${execution.output.diagnostics}`,
    `- ${execution.output.structured}`,
  ].join("\n");
};
