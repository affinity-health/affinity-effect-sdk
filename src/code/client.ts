import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import type { CredentialsOptions } from "../credentials.ts";
import { layer } from "../client.ts";
import { operationRegistry, type OperationKind, type OperationName } from "./registry.ts";

type AnyOperation = (input: any) => Effect.Effect<any, any, any>;
type AnyCodeOperation = (input: any) => Promise<any>;
type InputOf<Operation> = Operation extends (input: infer Input) => unknown ? Input : never;
type OutputOf<Operation> = Operation extends (input: any) => Effect.Effect<infer Output, any, any>
  ? Output
  : never;

type OperationEffects = {
  [Name in OperationName]: (typeof operationRegistry)[Name]["effect"];
};

export type AffinityCodeClient = {
  readonly [Name in OperationName]: (
    input: InputOf<OperationEffects[Name]>,
  ) => Promise<OutputOf<OperationEffects[Name]>>;
};

export interface OperationEvent {
  readonly kind: OperationKind;
  readonly method: string;
  readonly name: OperationName;
  readonly path: string;
  readonly requestNumber: number;
}

export interface CodeClientOptions extends CredentialsOptions {
  readonly allowClinical?: boolean;
  readonly allowMutations?: boolean;
  readonly confirmLive?: boolean;
  readonly maxRequests?: number;
  readonly mode?: "test" | "live";
  readonly onOperation?: (event: OperationEvent) => void;
  readonly timeoutMs?: number;
}

export class AgentPolicyError extends Error {
  readonly _tag = "AgentPolicyError";

  constructor(
    readonly operation: OperationName,
    readonly kind: OperationKind,
    message: string,
  ) {
    super(message);
    this.name = "AgentPolicyError";
  }

  toJSON() {
    return {
      _tag: this._tag,
      kind: this.kind,
      message: this.message,
      operation: this.operation,
    };
  }
}

export class AgentOperationError extends Error {
  readonly _tag = "AgentOperationError";

  constructor(
    readonly operation: OperationName,
    readonly causeTag: string,
    readonly details: unknown,
    message: string,
  ) {
    super(message);
    this.name = "AgentOperationError";
  }

  toJSON() {
    return {
      _tag: this._tag,
      causeTag: this.causeTag,
      details: this.details,
      message: this.message,
      operation: this.operation,
    };
  }
}

export interface AffinityCodeSession {
  readonly affinity: AffinityCodeClient;
  readonly dispose: () => Promise<void>;
  readonly operations: typeof operationRegistry;
}

const errorField = (error: unknown, field: string): unknown =>
  Predicate.isObject(error) ? error[field] : undefined;

const operationError = (operation: OperationName, error: unknown): AgentOperationError => {
  const tag = errorField(error, "_tag");
  const message = errorField(error, "message");
  return new AgentOperationError(
    operation,
    Predicate.isString(tag) ? tag : "UnknownError",
    error,
    Predicate.isString(message) ? message : `Affinity operation ${operation} failed`,
  );
};

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
};

export const createCodeSession = (options: CodeClientOptions): AffinityCodeSession => {
  const maxRequests = positiveInteger(options.maxRequests ?? 100, "maxRequests");
  const timeoutMs = positiveInteger(options.timeoutMs ?? 30_000, "timeoutMs");
  const mode = options.mode ?? "test";
  const runtime = ManagedRuntime.make(layer(options));
  let requestCount = 0;

  const client: Partial<Record<OperationName, AnyCodeOperation>> = {};

  for (const name of Object.keys(operationRegistry) as Array<OperationName>) {
    const operation = operationRegistry[name];
    client[name] = (input: unknown) => {
      if (operation.kind !== "read" && !options.allowMutations) {
        return Promise.reject(
          new AgentPolicyError(
            name,
            operation.kind,
            `${name} changes state; rerun with mutation access enabled`,
          ),
        );
      }
      if (operation.kind === "clinical" && !options.allowClinical) {
        return Promise.reject(
          new AgentPolicyError(
            name,
            operation.kind,
            `${name} is a clinical operation; explicit clinical access is required`,
          ),
        );
      }
      if (mode === "live" && operation.kind !== "read" && !options.confirmLive) {
        return Promise.reject(
          new AgentPolicyError(
            name,
            operation.kind,
            `${name} would change Live data; explicit Live confirmation is required`,
          ),
        );
      }

      requestCount += 1;
      if (requestCount > maxRequests) {
        return Promise.reject(
          new AgentPolicyError(
            name,
            operation.kind,
            `Request limit exceeded; this session allows ${maxRequests} operations`,
          ),
        );
      }

      options.onOperation?.({
        kind: operation.kind,
        method: operation.method,
        name,
        path: operation.path,
        requestNumber: requestCount,
      });

      const effect = (operation.effect as AnyOperation)(input).pipe(
        Effect.timeout(timeoutMs),
        Effect.result,
      );

      return runtime.runPromise(effect).then((result) => {
        if (Result.isFailure(result)) {
          throw operationError(name, result.failure);
        }
        return result.success;
      });
    };
  }

  return {
    affinity: client as unknown as AffinityCodeClient,
    dispose: () => runtime.dispose(),
    operations: operationRegistry,
  };
};

export const createClient = (options: CodeClientOptions): AffinityCodeClient =>
  createCodeSession(options).affinity;
