# Migrate to Token Billing - Working Log

**Started:** 2026-07-17
**Status:** Completed
**Task:** Replace premium-request quota calculations with GitHub Copilot token-billing calculations, update all supporting materials, validate the change, merge it, and publish a major release.

## Overview

- Verify GitHub's current token-billing model and relevant API response fields against current documentation.
- Update production code, tests, user/developer documentation, and release metadata.
- Run the complete local verification suite and validate GitHub Actions after opening the PR.
- Merge the PR and publish a new major GitHub release.

## Progress

### Repository orientation

- **Status:** ✓ Done
- Confirmed the checkout is clean on `main`, tracking `origin/main`.
- Identified the quota implementation and tests under `src/`, with project metadata in `package.json` and user/developer guidance in `README.md` and `CONTRIBUTING.md`.
- The current package metadata is `1.0.4`, while the latest repository tag is `v1.2.1`; the next major release must reconcile this as `2.0.0`.
- GitHub CLI is installed, but both its environment credential and the credential in the local remote are invalid. The connected GitHub app remains available for repository/PR mutations; tag/release publication will be re-evaluated after merge.

### Billing and API research

- **Status:** ✓ Done
- GitHub moved from premium-request billing to token-priced usage on 2026-06-01. Input, cached-input, and output tokens have model-specific prices and are normalized into GitHub AI Credits; raw tokens cannot be compared directly across models.
- GitHub documents `1 AI credit = $0.01 USD` and monthly individual-plan allowances of 1,500 (Pro), 7,000 (Pro+), and 20,000 (Max) credits. Included credits reset at 00:00 UTC on the first calendar day of each month.
- The official user endpoint is `GET /users/{username}/settings/billing/ai_credit/usage` with API version `2026-03-10`, and reports consumed credits in `usageItems[].grossQuantity`. It requires fine-grained `Plan: read` permission and only covers personally billed plans.
- The near-real-time internal endpoint retains the `premium_interactions` key but adds `token_based_billing`; under token billing the entitlement and fractional remaining values represent AI credits. It must not be interpreted as credits unless that discriminator is explicitly true.
- Further validation found that the internal snapshot can expose base credits rather than the documented base-plus-flex plan total (for example, 1,000 versus 1,500 on Pro).
- Decision: model the application in AI credits, retain the explicitly token-based internal snapshot as the preferred near-real-time usage source, use the official AI-credit endpoint as fallback, and always use `monthlyAiCreditLimit` as the quota denominator.

### Implementation

- **Status:** ✓ Done
- Created branch `agent/migrate-ai-credit-billing`.
- Replaced request-oriented domain fields with `usedAiCredits` and `monthlyAiCreditLimit`, retaining percentage-based working-day pacing.
- Updated the internal API parser to require an explicit token-billing discriminator, preserve fractional remaining credits, account for overage, and reject legacy request snapshots.
- Replaced the official fallback with the current `ai_credit/usage` endpoint, API version `2026-03-10`, calendar-month filters, and aggregation across all returned model slices.
- Migrated daily usage storage and all UI/report copy to AI Credit units. Cached usernames now use extension global state instead of an undeclared VS Code setting.

### Tests and documentation

- **Status:** ✓ Done
- Added mocked GitHub API contract tests for headers, fractional internal snapshots, rejection of legacy billing, multi-model credit aggregation, billing periods, and authentication errors.
- Updated calculator and status-bar tests for fractional AI Credits and the new UI terminology.
- Updated `README.md`, `CONTRIBUTING.md`, package metadata, configuration schema, lockfile metadata, and added `CHANGELOG.md` for version 2.0.0.
- Updated `.vscodeignore` so development logs, workflows, and test output are excluded from the production VSIX while user-facing README/changelog documentation remains included.
- Stale-reference scan found only intentional migration/legacy explanations plus internal variable/function names unrelated to the billing unit.
- `git diff --check`, `npm run lint`, and `npm run compile` completed successfully.
- The initial sandboxed extension-host run aborted before assertions because Electron could not run in the restricted host. The approved retry downloaded/used VS Code 1.129.0 and passed all 38 tests.
- A later run exposed that the non-fatal disposable warning came from status-bar test lifecycle state. Added explicit status-bar disposal/reset logic and wired it into extension deactivation and test teardown.
- Final validation is clean: `npm run lint`, `npm test` (38 passing), `npm run build`, and `npm run package` all succeeded without application warnings or failed assertions.
- The final 2.0.0 VSIX contains 15 files (manifest, README, changelog, and runtime bundles); tests, workflows, and development logs are excluded. Packaging retains the repository's pre-existing non-blocking warning that no license file exists.

### Final review and publication

- **Status:** ✓ Done
- `git diff --check` passed; version metadata is consistently `2.0.0` in the manifest and lockfile.
- Scanned tracked and new source/documentation files for credential patterns; the only match is the intentional PAT-format validation regex.
- Confirmed no stale request API endpoint, request-domain field, or old API-version reference remains. Legacy terminology appears only in migration notes, explicit rejection tests, and explanatory comments.
- Final reviewed scope includes production code, tests, user/developer documentation, release metadata, package exclusions, changelog, and this audit log.
- Committed the reviewed scope as `753c5ac` and pushed `agent/migrate-ai-credit-billing`.
- Opened ready-for-review PR #41. Its build/lint/compile job and Linux test job passed; macOS failed before tests because VS Code's IPC socket exceeded macOS's 103-character path limit in the long Actions checkout. Windows was canceled by matrix fail-fast.
- CI-fix decision: give `@vscode/test-electron` a short, unique `--user-data-dir` under the OS temp directory and remove it after the test host exits. This targets the observed runner-only infrastructure failure without changing application behavior.
- Verified the test-electron `launchArgs` contract in the installed official package, including that an explicit `--user-data-dir` suppresses its long default path.
- `npm run lint` and the complete local extension-host suite (38 passing) succeeded with the short temporary profile and cleanup logic.
- Published the CI fix as `fd70b3b`; PR #41 then passed build/lint/compile and extension-host tests on Linux, macOS, and Windows. Merged PR #41 as `4caae15`, and its post-merge `main` CI also passed.
- Created and pushed annotated tag `v2.0.0` on `4caae15`. The release workflow failed before build because the manifest was already `2.0.0` and `npm version` rejects an unchanged version by default.
- Verified npm's official `allowSameVersion` option. Decision: add `--allow-same-version` to the workflow so synchronized manifests are valid, merge the workflow fix separately, and publish the existing immutable tag manually with a freshly rebuilt VSIX.
- Executed the exact corrected `npm version 2.0.0 --no-git-tag-version --allow-same-version` command locally; it completed successfully without modifying package metadata.
- PR #42 passed build/lint/compile and extension-host tests on Linux, macOS, and Windows, then merged as `2c4bbe6`.
- Rebuilt the VSIX from the exact `v2.0.0` tag and published the public, non-prerelease GitHub release with asset `copilot-quota-alert-v2.0.0.vsix`.
- Verified the uploaded asset is 29,819 bytes and its GitHub digest matches the local artifact: `sha256:cc8927108e6a5a926089d7cdfed26bd19d8e5991e10e30adc908b0b14dca6528`.

## Remaining Work

- [x] Confirm current GitHub token-billing semantics and API contract.
- [x] Design and implement the new quota model.
- [x] Update and expand tests.
- [x] Update all documentation and release metadata.
- [x] Run formatting, linting, compilation, packaging, and tests.
- [x] Create and validate a PR.
- [x] Merge the PR.
- [x] Create and verify the next major release.

## Notes & Decisions

- The working tree was clean before task files were added, so no unrelated user changes need to be isolated.
- GitHub bills model-specific token usage in AI Credits; the extension intentionally displays credits rather than misleading raw-token totals.
- Version 2.0.0 is a breaking settings/storage migration because premium requests and AI Credits are incompatible units.
- Release: https://github.com/lenny-osp/vscode-copilot-quota-alert/releases/tag/v2.0.0
