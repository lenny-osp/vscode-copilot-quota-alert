# Copilot Quota Alert

A VS Code extension that monitors token-priced GitHub Copilot usage in **GitHub AI Credits** and helps you stay within your monthly allowance by calculating a safe daily quota from the number of working days (Mon–Fri) in the current month.

## Features

- **Token-billing Monitoring**: Tracks AI Credits, GitHub's normalized billing unit for model- and token-dependent Copilot usage.
- **Near-real-time Monitoring**: Uses GitHub's internal quota snapshot, including its live included allowance and finite additional-usage budget, when it explicitly reports token-based billing; the official AI Credit billing API is the fallback.
- **Working Day Pacing**: Calculates your quota based on actual working days (Monday–Friday).
- **Status Bar Integration**: Visual indicator of your current usage vs. today's safe quota.
- **Smart Alerts**: Color-coded status bar warning and once-per-day alert dialog when you exceed your safe quota.
- **Configurable Thresholds**: Allow yourself some "headroom" or get alerted early by adjusting the threshold percentage.
- **Flexible Authentication**: Automatically reuses your existing VS Code GitHub sign-in; a Personal Access Token can be used as a fallback.
- **Automatic Update Check**: Periodically checks for new releases on GitHub and notifies you when a newer version is available.

## How it Works

GitHub prices input, cached-input, and output tokens differently for each model, then converts the result to AI Credits (`1 AI credit = $0.01 USD`). Raw token counts are therefore not comparable across models; this extension paces the resulting AI Credit usage instead.

The extension calculates pacing using this logic:

1. **Total Working Days**: Counts Mon–Fri in the current calendar month (e.g., 22 days).
2. **Current Working Day**: Identifies how far you are into the month (e.g., Day 5).
3. **Safe Quota**: `(Current Day / Total Days) * 100`. (e.g., `5 / 22 = 22.7%`).
4. **Current Usage**: Fetches AI Credits consumed across all token-billed models and divides that by the monthly AI Credit allowance.
5. **Comparison**: If `Usage % > Safe Quota % + Threshold`, the extension triggers a warning.

Included AI Credits reset at 00:00 UTC on the first day of each calendar month. Allowances vary by plan, and users can configure a budget for additional usage. The extension uses GitHub's live `credits_used` and `entitlement` values, adding a finite additional-usage entitlement when present (for example, 7,618 used out of an 8,000 total produces 95.2%). The configurable total is used only as a fallback when GitHub's official usage endpoint reports consumption without an allowance.

## Setup

The extension resolves a GitHub token in the following order:

### Option A — VS Code GitHub session (recommended, zero-config)

If you are already signed in to GitHub inside VS Code (e.g. via **GitHub Copilot**, **GitHub Pull Requests**, or any other extension that uses the built-in GitHub authentication provider), the extension will silently reuse that session. **No extra steps are required.**

### Option B — Personal Access Token (manual fallback)

Use this when no VS Code GitHub session is available:

1. Run the command: `Copilot Quota Alert: Set GitHub Token`
2. Paste a **GitHub Personal Access Token (PAT)**.
   - For the official fallback endpoint, use a fine-grained token with **Plan: read-only** user permission.
   - The token must also be able to identify the current user (`read:user`).

The token is stored securely in VS Code's encrypted **SecretStorage** — it is never written to disk in plain text.

> **Note**: If both a session and a stored PAT are present, the VS Code session is always preferred.

## Usage

- **Status Bar Icon**:
  - `✅ Copilot: 15% / 25%` — Usage is within your daily budget.
  - `⚠️ Copilot: 30% / 25%` — Usage has exceeded today's safe quota.
- **Hover Tooltip**: Shows AI Credits used, working day progress, safe quota, and the active **authentication method** (`VS Code GitHub session` or `Personal Access Token`).
- **Click Status Bar**: Shows a detailed breakdown of AI Credit usage, working days, and current status.
- **Refresh**: Automatically refreshes every 5 minutes (configurable), or use the `Copilot Quota Alert: Refresh Quota` command.

## Settings

- `copilot-quota-alert.thresholdPercent`: (Default: `0`) Positive values allow more usage before alerting; negative values alert you earlier.
- `copilot-quota-alert.extraHolidayCount`: (Default: `0`) Deducts non-weekend holidays from this month's working days; resets monthly.
- `copilot-quota-alert.refreshIntervalMinutes`: (Default: `5`) Frequency of automatic updates.
- `copilot-quota-alert.monthlyAiCreditLimit`: (Default: `1500`) Fallback monthly AI Credit allowance. The live included and additional-usage entitlements take precedence; set this only for accounts that must use the official fallback usage endpoint.
- `copilot-quota-alert.checkForUpdates`: (Default: `true`) Automatically check for new versions on extension activation.

> **Version 2 migration:** `monthlyLimit` represented premium requests and has been removed. If you customized it, configure `monthlyAiCreditLimit` as the fallback allowance; GitHub's live entitlements take precedence.

## Data Source Limitations

- The official user billing endpoint only reports Copilot usage billed directly to an individual's personal account and may lag behind real-time usage.
- The near-real-time token-billing snapshot supplies consumed credits, included entitlement, and any finite additional-usage entitlement; the extension adds the entitlements for the quota denominator.
- Organization- or enterprise-managed seats are billed at the organization/enterprise level. Their pooled usage is not available from the user endpoint; the extension can only calculate usage when GitHub's internal snapshot exposes a finite per-user credit balance.
- Existing annual Pro or Pro+ subscribers who remain on GitHub's legacy request-based billing are not treated as AI Credit accounts. Version 2 intentionally avoids mixing legacy request counts with credit values.

See GitHub's documentation for [usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals), [model and per-token pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing), and the [AI Credit billing API](https://docs.github.com/en/rest/billing/usage#get-billing-ai-credit-usage-report-for-a-user).

## Installation & Updates

### Option 1: GitHub Releases (Recommended)
1. Go to the [Releases](https://github.com/lenny-osp/vscode-copilot-quota-alert/releases) page.
2. Download the latest `.vsix` file (e.g., `copilot-quota-alert-v2.0.0.vsix`).
3. In VS Code, open the **Extensions** view (`Cmd+Shift+X` or `Ctrl+Shift+X`).
4. Click the **...** (Views and More Actions) in the top right of the Extensions bar.
5. Select **Install from VSIX...**.
6. Select the downloaded `.vsix` file.

When an update notification appears, choose **Download VSIX** to open the latest release's `.vsix` asset directly on GitHub.

> **Tip**: To **update** the extension, simply follow the steps above with the new `.vsix` file. VS Code will automatically replace the old version with the new one.

### Option 2: Build from Source
1. Clone this repository.
2. Run `npm install`.
3. Package the extension: `npx @vscode/vsce package`.
4. Install the generated `.vsix` file as described in Option 1.

## Development

- Press `F5` to open the Extension Development Host for testing.
- Type-check with `npm run lint` and `npm run compile`.
- Run the full VS Code extension-host suite with `npm test`.
- Build with `npm run build` and package with `npm run package`.
- Watch for changes with `npm run watch`.
