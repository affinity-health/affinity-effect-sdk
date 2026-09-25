export type CodeMode = "test" | "live";

export function resolveCodeMode(apiKey: string, requested?: CodeMode): CodeMode {
  const match = /^sk_(test|live)_/.exec(apiKey.trim());
  const actual = match?.[1];
  if (actual !== "test" && actual !== "live") {
    throw new TypeError("Cannot determine credential mode; use an Affinity Test or Live API key");
  }
  if (requested && requested !== actual) {
    throw new TypeError(`The credential is ${actual} mode, but ${requested} mode was requested`);
  }
  return actual;
}
