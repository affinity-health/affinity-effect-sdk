import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(join(tmpdir(), "affinity-effect-consumer-"));
const run = (cwd: string, args: string[]) => {
  const result = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0)
    throw new Error(
      `${args[0]} ${args[1]} failed: ${result.stderr.toString()}${result.stdout.toString()}`,
    );
  return result.stdout.toString();
};
try {
  const archive = join(temporary, "sdk.tgz");
  run(root, ["bun", "pm", "pack", "--filename", archive]);
  await Bun.write(
    join(temporary, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { "@affinity-health/effect-sdk": `file:${archive}`, effect: "4.0.0-rc.112" },
    }),
  );
  run(temporary, ["bun", "install"]);
  const version = run(temporary, [
    "bun",
    "node_modules/@affinity-health/effect-sdk/dist/cli.mjs",
    "--version",
  ]);
  const operations = JSON.parse(
    run(temporary, [
      "bun",
      "node_modules/@affinity-health/effect-sdk/dist/cli.mjs",
      "operations",
      "--json",
    ]),
  );
  for (const name of [
    "previewOrder",
    "createOrder",
    "signOrder",
    "submitOrder",
    "signAndSubmitOrder",
  ]) {
    if (!operations.some((operation: { name: string }) => operation.name === name))
      throw new Error(`Missing operation ${name}`);
  }
  await Bun.write(
    join(temporary, "smoke.ts"),
    `import {createCodeSession} from "@affinity-health/effect-sdk/code";
import * as operations from "@affinity-health/effect-sdk/operations";
const session=createCodeSession({apiKey:"sk_test_synthetic"});
if (typeof session.affinity.createOrder !== "function" || typeof operations.signOrder !== "function") throw new Error("Missing order operations");
await session.dispose();`,
  );
  run(temporary, ["bun", "smoke.ts"]);
  console.log(
    `${version.trim()}: clean packed install exposes ${operations.length} operations without overrides.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
