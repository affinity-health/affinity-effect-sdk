const generatedFiles = ["src/services/affinity.ts", "src/services/index.ts"] as const;

const before = await Promise.all(
  generatedFiles.map(async (file) => [file, await Bun.file(file).text()] as const),
);

const process = Bun.spawn(["bun", "run", "generate"], {
  cwd: `${import.meta.dir}/..`,
  stdout: "inherit",
  stderr: "inherit",
});

if ((await process.exited) !== 0) {
  throw new Error("SDK generation failed");
}

const changed: string[] = [];
for (const [file, contents] of before) {
  if ((await Bun.file(file).text()) !== contents) changed.push(file);
}

if (changed.length > 0) {
  throw new Error(`Generated files are stale: ${changed.join(", ")}`);
}
