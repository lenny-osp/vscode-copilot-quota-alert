# Fix AI Credit entitlement and release download link

## Goal

- Calculate quota percentages with the total AI Credit entitlement returned by GitHub instead of the configured 1,500-credit fallback.
- Open the latest GitHub release's `.vsix` asset from update notifications instead of the VS Code Marketplace.
- Update tests and documentation, then run the full validation suite.

## Progress

- 2026-07-17: Confirmed a clean `main` worktree.
- 2026-07-17: Located the quota denominator bug in `fetchCopilotInternalAiCredits`: usage comes from the live entitlement, but the returned total comes from the configured fallback.
- 2026-07-17: Located the update action in `checkForUpdates`: it currently opens a hard-coded Marketplace URL and does not parse release assets.
- 2026-07-17: Implemented live total calculation as included entitlement plus finite additional-usage entitlement, and persisted that total for daily reports.
- 2026-07-17: Implemented `.vsix` asset selection from the latest release, with the GitHub release page as a safe fallback.
- 2026-07-17: Type-checking passed. The first extension-host test run reached 40 passing tests; one exact floating-point assertion failed and was corrected to use a tolerance.
- 2026-07-17: Confirmed from GitHub's current billing documentation that additional-usage budgets are denominated in US dollars and map to AI credits at 100 credits per dollar.
- 2026-07-17: Confirmed from GitHub's current Copilot SDK schema that `overage_entitlement` is the finite pay-as-you-go additional-usage budget cap in AI credits.
- 2026-07-17: Confirmed from GitHub's Releases API documentation that release assets expose `browser_download_url`, and from the VS Code Extension API that `env.openExternal` opens HTTPS links in the system browser.
- 2026-07-17: Initial final validation passed: `npm run lint`, production build, VSIX packaging, and 42 extension-host tests.
- 2026-07-17: A read-only live snapshot check confirmed `credits_used: 7618`, `entitlement: 8000`, and token-based billing. Updated the adapter to prefer `credits_used` and retain the remaining-balance formula for backward compatibility.
- 2026-07-17: Rebuilt, repackaged, and reran the expanded final suite after live-schema validation; all 43 extension-host tests passed.

## Decisions

- Keep `monthlyAiCreditLimit` as a fallback for the official usage endpoint, which reports consumption but does not expose an allowance.
- Add the finite `overage_entitlement` (additional-usage budget) to the included entitlement from the near-real-time internal quota snapshot. This handles totals such as 7,000 included + 1,000 additional = 8,000.
- Select a `.vsix` asset from the latest GitHub release and fall back to the release page if a release has no VSIX asset.

## Status

Completed.
