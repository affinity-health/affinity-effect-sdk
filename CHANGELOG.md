# Changelog

## Unreleased

## [0.4.0] - 2026-09-24

### Fixed

- Pin the compatible Effect runtime and platform dependencies so the CLI works without consumer overrides.
- Regenerate 74 public operations from the deployed 2026-08-11 API contract, including preview, create, sign, submit, and sign-and-submit.
- Retain the existing internal pricing and formulation operations. Replace retired user, membership, and provider-mapping operations with the current practice team API.
- Keep signing, submission, and prescription edits behind the CLI's clinical mutation permission.

## [0.3.1] - 2026-08-31

### Fixed

- The CLI now reports the installed package version correctly.

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
[0.3.1]: https://github.com/affinity-health/affinity-effect-sdk/compare/v0.3.0...v0.3.1
