import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/code/index.ts", "src/services/affinity.ts", "src/cli.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    clean: true,
    checks: {
      invalidAnnotation: false,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: ["dist/**", ".generated-specs/**", "src/services/**"],
  },
  fmt: {
    ignorePatterns: ["dist/**", ".generated-specs/**", "src/services/**", "spec/**"],
  },
});
