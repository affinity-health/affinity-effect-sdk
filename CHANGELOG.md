# Changelog

## Unreleased

## [0.3.0] - 2026-08-31

### Added

- Six typed pricing operations for pharmacy costs, market prices, and organization price books.

### Changed

- Device authorization now presents read or write access instead of exposing the internal scope list.
- Write access includes pricing when Affinity Internal is selected.
- Authentication status now reports the access level instead of internal scopes.

## [0.2.0] - 2026-08-31

### Added

- Multi-organization device login with explicit organization selection per invocation.
- Organization context on generated SDK requests through `X-Affinity-Organization-Id`.

### Changed

- Saved device credentials now include the organizations approved during login.

## [0.1.0] - 2026-08-31

### Added

- Initial Effect-native Affinity API client.
- OpenAPI-to-Smithy-to-Effect generation pipeline based on Distilled.
- Await-friendly code-mode client generated for all API operations.
- Effect v4 `affinity` runner with `eval`, `run`, `operations`, and `doctor` commands.
- Read-only defaults, explicit mutation and clinical access, Live confirmation, request limits, and per-operation timeouts.
- Agent context output with the complete generated operation catalog and safety contract.
- OAuth device authorization commands with read-only and read/write scope profiles.

[0.1.0]: https://github.com/affinity-health/affinity-effect-sdk/releases/tag/v0.1.0
[0.2.0]: https://github.com/affinity-health/affinity-effect-sdk/compare/v0.1.0...v0.2.0
[0.3.0]: https://github.com/affinity-health/affinity-effect-sdk/compare/v0.2.0...v0.3.0
