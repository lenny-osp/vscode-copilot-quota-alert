# Copilot Quota Alert

A VS Code extension that monitors your GitHub Copilot Premium Request usage and helps you stay within your monthly budget by calculating a **safe daily quota** based on the number of working days (Mon–Fri) in the current month.

## Features

- **Real-time Monitoring**: Fetches usage data from GitHub's internal API for near real-time accuracy.
- **Working Day Pacing**: Calculates your quota based on actual working days (Monday–Friday).
- **Status Bar Integration**: Visual indicator of your current usage vs. today's safe quota.
- **Smart Alerts**: Color-coded status bar warning and once-per-day alert dialog when you exceed your safe quota.
- **Configurable Thresholds**: Allow yourself some "headroom" or get alerted early by adjusting the threshold percentage.

## How it Works

The extension calculates your pacing using this logic:
1. **Total Working Days**: Counts Mon–Fri in the current calendar month (e.g., 22 days).
2. **Current Working Day**: Identifies how far you are into the month (e.g., Day 5).
3. **Safe Quota**: `(Current Day / Total Days) * 100`. (e.g., `5 / 22 = 22.7%`).
4. **Current Usage**: Fetches your premium request count via GitHub API.
5. **Comparison**: If `Usage % > Safe Quota % + Threshold`, the extension triggers a warning.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup your Token**:
   - Run the command: `Copilot Quota Alert: Set GitHub Token`
   - Paste a **GitHub Personal Access Token (PAT)**.
   - The PAT needs the `copilot` scope (for Classic PATs) or "Plan: read-only" (for Fine-grained tokens).

## Usage

- **Status Bar Icon**:
  - `✅ Copilot: 15% / 25%` — Usage is within your daily budget.
  - `⚠️ Copilot: 30% / 25%` — Usage has exceeded today's safe quota.
- **Click Status Bar**: Shows a detailed breakdown of your requests, working days, and current status.
- **Refresh**: Automatically refreshes every 30 minutes, or use the `Copilot Quota Alert: Refresh Quota` command.

## Settings

- `copilot-quota-alert.thresholdPercent`: (Default: `0`) Positive values allow more usage before alerting; negative values alert you earlier.
- `copilot-quota-alert.refreshIntervalMinutes`: (Default: `5`) Frequency of automatic updates.
- `copilot-quota-alert.monthlyLimit`: (Default: `300`) Fallback limit if the API does not return your plan entitlement.

## Installation

### Option 1: GitHub Releases (Recommended)
1. Go to the [Releases](https://github.com/lenny-osp/vscode-copilot-quota-alert/releases) page.
2. Download the latest `.vsix` file (e.g., `copilot-quota-alert-0.0.1.vsix`).
3. In VS Code, open the **Extensions** view (`Cmd+Shift+X` or `Ctrl+Shift+X`).
4. Click the **...** (Views and More Actions) in the top right of the Extensions bar.
5. Select **Install from VSIX...**.
6. Select the downloaded `.vsix` file.

### Option 2: Build from Source
1. Clone this repository.
2. Run `npm install`.
3. Package the extension: `npx @vscode/vsce package`.
4. Install the generated `.vsix` file as described in Option 1.

## Development

- Press `F5` to open the Extension Development Host for testing.
- Build with `npm run build`.
- Watch for changes with `npm run watch`.
