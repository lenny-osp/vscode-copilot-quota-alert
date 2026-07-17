# Changelog

All notable changes to Copilot Quota Alert are documented here.

## Unreleased

### Fixed

- Use GitHub's live `credits_used` and total AI Credit entitlement (including any finite additional-usage entitlement) instead of applying the 1,500-credit fallback to live quota snapshots.
- Open the latest GitHub release's `.vsix` asset from update notifications instead of the VS Code Marketplace.
- Align the VS Code 1.120 engine requirement and API typings so the release pipeline can package the extension successfully.

### Changed

- Require Visual Studio Code 1.120.0 or later.

## 2.0.0 - 2026-07-17

### Changed

- Replaced legacy premium-request accounting with token-priced GitHub AI Credit accounting.
- Added support for fractional credit balances and overage usage from token-based quota snapshots.
- Switched the official fallback to GitHub's AI Credit usage endpoint and API version `2026-03-10`.
- Renamed `monthlyLimit` to `monthlyAiCreditLimit` and changed the default from 300 requests to 1,500 AI Credits.
- Updated status, detail, alert, and daily-report copy and storage to use AI Credit units.

### Compatibility

- This is a breaking release for users with a customized `monthlyLimit`; configure `monthlyAiCreditLimit` instead.
- Legacy annual plans still billed in premium requests are intentionally not interpreted as AI Credit plans.
