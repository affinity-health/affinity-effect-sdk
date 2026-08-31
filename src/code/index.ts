export {
  AgentOperationError,
  AgentPolicyError,
  createClient,
  createCodeSession,
  type AffinityCodeClient,
  type AffinityCodeSession,
  type CodeClientOptions,
  type OperationEvent,
} from "./client.ts";
export { operationRegistry, type OperationKind, type OperationName } from "./registry.ts";

export interface AgentProgramContext {
  readonly affinity: import("./client.ts").AffinityCodeClient;
  readonly log: (...values: ReadonlyArray<unknown>) => void;
  readonly operations: typeof import("./registry.ts").operationRegistry;
}

export type AgentProgram = (context: AgentProgramContext) => unknown | Promise<unknown>;
