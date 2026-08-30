const packageJson = await Bun.file("package.json").json();

for (const [subpath, entry] of Object.entries(packageJson.exports)) {
  const paths = Object.values(entry as Record<string, string>);
  for (const path of paths) {
    if (!(await Bun.file(path).exists())) {
      throw new Error(`Missing package export ${subpath}: ${path}`);
    }
  }
}

await import(`${import.meta.dir}/../dist/index.mjs`);
await import(`${import.meta.dir}/../dist/services/affinity.mjs`);

console.log("Package exports are present and importable.");
