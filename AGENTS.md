# Repository instructions

- Use Bun for installs and scripts.
- Use Vite+ for checks, tests, and library builds.
- Generate service operations from `spec/affinity.openapi.json`; do not edit `src/services` by hand.
- Keep the public API Effect-native. Do not run Effects inside the library.
- Keep credentials injectable and resolve them for each request.
- Never commit API keys or real patient data.

# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect APIs and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.
