const packageJson = await Bun.file("package.json").json();

for (const [subpath, entry] of Object.entries(packageJson.exports)) {
  const paths = Object.values(entry as Record<string, string>);
  for (const path of paths) {
    if (!(await Bun.file(path).exists())) {
      throw new Error(`Missing package export ${subpath}: ${path}`);
    }
  }
}

for (const [name, path] of Object.entries(packageJson.bin)) {
  if (!(await Bun.file(path as string).exists())) {
    throw new Error(`Missing package executable ${name}: ${path}`);
  }
}

const version = Bun.spawnSync(["bun", packageJson.bin.affinity, "--version"], {
  stderr: "pipe",
  stdout: "pipe",
});
if (
  version.exitCode !== 0 ||
  version.stdout.toString().trim() !== `affinity v${packageJson.version}`
) {
  throw new Error("The packaged CLI version does not match package.json");
}

await import(`${import.meta.dir}/../dist/index.mjs`);
await import(`${import.meta.dir}/../dist/code/index.mjs`);
await import(`${import.meta.dir}/../dist/services/affinity.mjs`);

console.log("Package exports are present and importable.");
