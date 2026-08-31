import { mkdir, readFile, rename, rm, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_API_BASE_URL } from "./credentials.ts";

export const DEVICE_CLIENT_ID = "affinity-cli";
export const DEFAULT_DEVICE_SCOPES = [
  "catalog:read",
  "orders:read",
  "patients:read",
  "practices:read",
  "users:read",
] as const;
export const WRITE_DEVICE_SCOPES = [
  "catalog:read",
  "catalog_pricing:read",
  "catalog_pricing:write",
  "component_sessions:write",
  "hosted_sessions:write",
  "memberships:read",
  "memberships:write",
  "orders:read",
  "orders:write",
  "patients:read",
  "patients:write",
  "practices:read",
  "practices:write",
  "providers:read",
  "providers:write",
  "roles:read",
  "roles:write",
  "users:read",
  "users:write",
  "webhooks:read",
  "webhooks:write",
] as const;

export interface DeviceAuthorization {
  readonly device_code: string;
  readonly expires_in: number;
  readonly interval?: number;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly verification_uri_complete?: string;
}

export interface DeviceCredential {
  readonly accessToken: string;
  readonly apiBaseUrl: string;
  readonly expiresAt: string;
  readonly mode: "live" | "test";
  readonly organizations: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly scopes: ReadonlyArray<string>;
  readonly tokenType: "Bearer";
}

interface TokenSuccess {
  readonly access_token: string;
  readonly expires_in: number;
  readonly organizations: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly scope: string;
  readonly token_type: "Bearer";
}

interface TokenFailure {
  readonly error: "access_denied" | "authorization_pending" | "expired_token" | "slow_down";
  readonly error_description?: string;
}

export class DeviceAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DeviceAuthError";
  }
}

export const credentialPath = (): string => {
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(configHome, "affinity", "credentials.json");
};

const parseCredential = (value: unknown): DeviceCredential | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (
    typeof item.accessToken !== "string" ||
    typeof item.apiBaseUrl !== "string" ||
    typeof item.expiresAt !== "string" ||
    (item.mode !== "test" && item.mode !== "live") ||
    item.tokenType !== "Bearer" ||
    !Array.isArray(item.organizations) ||
    !item.organizations.every(
      (organization) =>
        organization !== null &&
        typeof organization === "object" &&
        typeof (organization as Record<string, unknown>).id === "string" &&
        typeof (organization as Record<string, unknown>).name === "string",
    ) ||
    !Array.isArray(item.scopes) ||
    !item.scopes.every((scope) => typeof scope === "string")
  )
    return undefined;
  return item as unknown as DeviceCredential;
};

export const readDeviceCredential = async (): Promise<DeviceCredential | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(credentialPath(), "utf8"));
    return parseCredential(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

export const writeDeviceCredential = async (credential: DeviceCredential): Promise<void> => {
  const target = credentialPath();
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(dirname(target), { mode: 0o700, recursive: true });
  await writeFile(temporary, `${JSON.stringify(credential, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, target);
  await chmod(target, 0o600);
};

export const deleteDeviceCredential = (): Promise<void> => rm(credentialPath(), { force: true });

const postJson = async <T>(
  apiBaseUrl: string,
  path: string,
  body: Record<string, string>,
): Promise<T> => {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/u, "")}${path}`, {
    headers: { accept: "application/json", "content-type": "application/json" },
    method: "POST",
    body: JSON.stringify(body),
  });
  const value: unknown = await response.json();
  if (!response.ok && response.status >= 500) {
    throw new DeviceAuthError("Affinity device authorization is unavailable", "server_error");
  }
  return value as T;
};

export const startDeviceAuthorization = async (options?: {
  readonly apiBaseUrl?: string;
  readonly mode?: "live" | "test";
  readonly scopes?: ReadonlyArray<string>;
}): Promise<DeviceAuthorization> => {
  const apiBaseUrl = options?.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const body = {
    client_id: DEVICE_CLIENT_ID,
    mode: options?.mode ?? "test",
    scope: (options?.scopes ?? DEFAULT_DEVICE_SCOPES).join(" "),
  };
  return postJson<DeviceAuthorization>(apiBaseUrl, "/v1/oauth/device/authorization", body);
};

export const pollDeviceAuthorization = async (options: {
  readonly apiBaseUrl?: string;
  readonly authorization: DeviceAuthorization;
  readonly signal?: AbortSignal;
}): Promise<DeviceCredential> => {
  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const expiresAt = Date.now() + options.authorization.expires_in * 1_000;
  let intervalMs = Math.max(options.authorization.interval ?? 5, 1) * 1_000;

  while (Date.now() < expiresAt) {
    await Bun.sleep(intervalMs);
    if (options.signal?.aborted) throw new DeviceAuthError("Device login cancelled", "cancelled");
    const result = await postJson<TokenSuccess | TokenFailure>(apiBaseUrl, "/v1/oauth/token", {
      client_id: DEVICE_CLIENT_ID,
      device_code: options.authorization.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    if ("access_token" in result) {
      return {
        accessToken: result.access_token,
        apiBaseUrl,
        expiresAt: new Date(Date.now() + result.expires_in * 1_000).toISOString(),
        mode: result.access_token.startsWith("sk_live_") ? "live" : "test",
        organizations: result.organizations,
        scopes: result.scope.split(" ").filter(Boolean),
        tokenType: result.token_type,
      };
    }
    if (result.error === "authorization_pending") continue;
    if (result.error === "slow_down") {
      intervalMs += 5_000;
      continue;
    }
    throw new DeviceAuthError(
      result.error_description ?? `Device login failed: ${result.error}`,
      result.error,
    );
  }
  throw new DeviceAuthError("Device login expired", "expired_token");
};

export const revokeDeviceCredential = async (credential: DeviceCredential): Promise<void> => {
  const response = await fetch(`${credential.apiBaseUrl.replace(/\/+$/u, "")}/v1/oauth/revoke`, {
    body: JSON.stringify({ token: credential.accessToken }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok)
    throw new DeviceAuthError("Affinity could not revoke this login", "revoke_failed");
};
