# Fix VSCE VS Code version mismatch - Working Log

**Started:** 2026-07-17  
**Status:** Completed  
**Task:** Fix release packaging failure caused by `@types/vscode` resolving newer than `engines.vscode`.

## Overview

- Target VS Code 1.120 and later, as approved by the user.
- Align the development API typings with the minimum supported VS Code version.
- Reproduce the release packaging command and rerun validation.

## Progress

### Diagnose packaging failure

- **Status:** ✓ Done
- Found `engines.vscode` at `^1.85.0` while `@types/vscode` is `^1.120.0` in both `package.json` and `package-lock.json`.
- The caret range on `@types/vscode` permits future 1.x API packages, so dependency refreshes can silently exceed the declared minimum engine.
- Initial decision: pin `@types/vscode` exactly to `1.85.0` to preserve compatibility; superseded after the user approved a VS Code 1.120 minimum.

### Verify current packaging guidance

- **Status:** ✓ Done
- Context7 resolved the official VSCE project (`/microsoft/vscode-vsce`); its indexed README confirms the current package/publish tooling but does not detail this validation rule.
- The installed official VSCE 3.9.1 reproduces the release failure locally with the exact compatibility error.
- Command: `npx --no-install @vscode/vsce package --out /tmp/copilot-quota-alert-before-types-fix.vsix`.

### Apply and test fix

- **Status:** ✓ Done
- The first sandboxed `npm install` attempt stalled on registry access and was stopped without useful output.
- Reran with repository-scoped network permission: `npm install --save-dev --save-exact @types/vscode@1.85.0`.
- Updated `package.json`, `package-lock.json`, and local dependencies to exact `@types/vscode` 1.85.0; `@vscode/vsce` remains 3.9.1.
- `npm ls @types/vscode @vscode/vsce --depth=0` confirms the intended versions.
- User approved raising the minimum supported VS Code version to 1.120.0. Updated `engines.vscode` to `^1.120.0`; next, the typings will be repinned exactly to 1.120.0.
- Installed and locked exact `@types/vscode` 1.120.0. The package metadata and lockfile now agree on a VS Code 1.120 minimum/API surface.
- Documented the VS Code 1.120 minimum in `README.md` and the release-pipeline compatibility fix in `CHANGELOG.md`.
- Final caret-range validation passed: `git diff --check`, `npm run lint`, the production prepublish build, and `npx --no-install @vscode/vsce package` all succeeded.
- The full extension-host suite passed earlier in this task with the same resolved `@types/vscode` 1.120.0 package: 43 passing tests.

## Remaining Work

- [x] Verify the VSCE compatibility rule against current documentation and the installed validator.
- [x] Pin `@types/vscode` and update the lockfile.
- [x] Run lint, tests, build, and the release-equivalent packaging command.

## Notes & Decisions

- The user explicitly accepted dropping support for VS Code 1.85–1.119, so the extension now targets VS Code 1.120 and later.
- Initial recommendation was to keep `@types/vscode` exact to constrain the compile-time API surface; superseded by the user's explicit choice of a caret range.
- Clarification: `@types/vscode: "^1.120.0"` is accepted by VSCE when `engines.vscode` is also `^1.120.0`. The remaining concern is API compatibility: a future typings release within the caret range can expose APIs unavailable in the minimum supported VS Code 1.120 runtime.
- User explicitly selected the caret range. Updated both `package.json` and the root lockfile dependency specifier to `@types/vscode: "^1.120.0"`; the resolved lockfile package remains 1.120.0.
