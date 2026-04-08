/**
 * Status bar UI management for the Copilot Quota Alert extension.
 *
 * Displays a status bar item with current usage vs safe quota,
 * color-coded to indicate whether the user is on track or over budget.
 */

import * as vscode from "vscode";
import type { QuotaSummary } from "./quota-calculator";
import { getLatestDiscoveredVersion, isNewerVersion } from "./update-checker";

let statusBarItem: vscode.StatusBarItem | undefined;

// Track the last alert date so we only show the warning dialog once per day
let lastAlertDate: string | undefined;

/**
 * Creates and returns the status bar item. Call once during activation.
 */
export function createStatusBarItem(
    context: vscode.ExtensionContext
): vscode.StatusBarItem {
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    return statusBarItem;
}

/**
 * Shows a "no token" prompt in the status bar.
 */
export function showNoToken(): void {
    if (!statusBarItem) {
        return;
    }
    statusBarItem.text = "$(key) Copilot Quota: Sign in";
    statusBarItem.tooltip =
        "No GitHub session or token found.\n" +
        "Click to authenticate via VS Code GitHub session or Personal Access Token (PAT).";
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.command = "copilot-quota-alert.setToken";
}

/**
 * Shows a loading spinner in the status bar.
 */
export function showLoading(): void {
    if (!statusBarItem) {
        return;
    }
    statusBarItem.text = "$(sync~spin) Copilot Quota...";
    statusBarItem.tooltip = "Fetching Copilot usage data...";
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = undefined;
}

/**
 * Shows an error state in the status bar.
 */
export function showError(message: string): void {
    if (!statusBarItem) {
        return;
    }
    statusBarItem.text = "$(error) Copilot Quota: Error";
    statusBarItem.tooltip = message;
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.command = "copilot-quota-alert.refresh";
}

/**
 * Shows the token expired state.
 */
export function showTokenExpired(): void {
    if (!statusBarItem) {
        return;
    }
    statusBarItem.text = "$(key) Copilot Quota: Token Expired";
    statusBarItem.tooltip =
        "Your GitHub token is invalid or revoked. Click to set a new one.";
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
    );
    statusBarItem.command = "copilot-quota-alert.setToken";
}

/**
 * Updates the status bar with the current quota summary.
 * Also triggers an alert dialog if the user is over budget.
 */
export function updateStatusBar(summary: QuotaSummary, authSource?: "session" | "pat"): void {
    if (!statusBarItem) {
        return;
    }

    const usagePct = summary.usagePercent.toFixed(1);
    const safePct = summary.safeQuotaPercent.toFixed(1);

    if (summary.isOverBudget) {
        statusBarItem.text = `$(warning) Copilot: ${usagePct}% / ${safePct}%`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
            "statusBarItem.warningBackground"
        );
        statusBarItem.color = undefined;
    } else {
        statusBarItem.text = `$(check) Copilot: ${usagePct}% / ${safePct}%`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.color = undefined;
    }

    // Build detailed tooltip
    const tooltipLines = [
        `Copilot Premium Request Usage`,
        `───────────────────────────────`,
        `Used: ${summary.usedRequests} / ${summary.monthlyLimit} requests`,
        `Usage: ${usagePct}%`,
        ``,
        `Working day: ${summary.currentWorkingDay} of ${summary.totalWorkingDays}`,
        `Daily quota: ${summary.dailyQuotaPercent.toFixed(1)}% per working day`,
        `Safe quota for today: ${safePct}%`,
        ``,
        summary.isOverBudget
            ? `⚠️ Over budget! Consider reducing usage.`
            : `✅ On track. You're within your daily budget.`,
        ...(authSource ? [
            ``,
            `Auth: ${authSource === "session" ? "VS Code GitHub session" : "Personal Access Token"}`,
        ] : []),
        ``,
    ];

    const currentVersion = vscode.extensions.getExtension('chihling.copilot-quota-alert')?.packageJSON.version ?? 'unknown';
    const latestVersion = getLatestDiscoveredVersion();
    let versionText = `Version: ${currentVersion}`;
    if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
        versionText += ` (New version v${latestVersion.replace(/^v/i, '')} available!)`;
    }
    tooltipLines.push(versionText);

    statusBarItem.tooltip = tooltipLines.join("\n");
    statusBarItem.command = "copilot-quota-alert.checkQuota";

    // Show warning dialog if over budget (once per day)
    if (summary.isOverBudget) {
        showAlertDialog(summary);
    }
}

/**
 * Shows a warning dialog when over budget, but only once per calendar day.
 */
function showAlertDialog(summary: QuotaSummary): void {
    const today = new Date().toISOString().slice(0, 10);
    if (lastAlertDate === today) {
        return; // Already alerted today
    }

    lastAlertDate = today;

    const usagePct = summary.usagePercent.toFixed(1);
    const safePct = summary.safeQuotaPercent.toFixed(1);

    vscode.window.showWarningMessage(
        `Copilot Quota Alert: Your usage (${usagePct}%) exceeds today's safe quota (${safePct}%). ` +
        `You're on working day ${summary.currentWorkingDay} of ${summary.totalWorkingDays}. ` +
        `Consider reducing premium request usage to stay within budget.`,
        "OK",
        "Don't alert today"
    );
}

/**
 * Shows a detailed information dialog with full quota breakdown.
 */
export function showQuotaDetails(summary: QuotaSummary): void {
    const usagePct = summary.usagePercent.toFixed(1);
    const safePct = summary.safeQuotaPercent.toFixed(1);
    const dailyPct = summary.dailyQuotaPercent.toFixed(1);

    const status = summary.isOverBudget ? "⚠️ OVER BUDGET" : "✅ On Track";

    const message = [
        `${status}`,
        ``,
        `Usage: ${summary.usedRequests} / ${summary.monthlyLimit} requests (${usagePct}%)`,
        `Working Day: ${summary.currentWorkingDay} of ${summary.totalWorkingDays}`,
        `Daily Quota: ${dailyPct}% per working day`,
        `Safe Quota for Today: ${safePct}%`,
    ].join("\n");

    if (summary.isOverBudget) {
        vscode.window.showWarningMessage(message);
    } else {
        vscode.window.showInformationMessage(message);
    }
}

/**
 * Shows the daily usage report for the current month.
 */
export function showDailyUsageReport(context: vscode.ExtensionContext): void {
    const dailyUsage = context.globalState.get<Record<string, number>>("copilot-quota-alert.dailyUsage");
    
    if (!dailyUsage || Object.keys(dailyUsage).length === 0) {
        vscode.window.showInformationMessage("No daily usage data recorded for the current month yet.");
        return;
    }

    const config = vscode.workspace.getConfiguration("copilot-quota-alert");
    const monthlyLimit = config.get<number>("monthlyLimit") ?? 300;

    const sortedDates = Object.keys(dailyUsage).sort();
    const augmentedUsage: Record<string, number> = { ...dailyUsage };

    const firstDateStr = sortedDates[0];
    const [fy, fm, fd] = firstDateStr.split('-').map(Number);
    const baselineDateObj = new Date(fy, fm - 1, fd);
    
    // Determine end date
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastRecordedStr = sortedDates[sortedDates.length - 1];
    const endDateStr = lastRecordedStr > todayStr ? lastRecordedStr : todayStr;
    const [ey, em, ed] = endDateStr.split('-').map(Number);
    const endDateObj = new Date(ey, em - 1, ed);

    const messageLines = ["Daily Quota Usage (Current Month):", ""];

    let processDateObj = new Date(baselineDateObj);
    let previousAbsolute = 0;
    
    // We already established a baseline from extension.ts which is the first item in the list, 
    // it will just naturally be calculated. Wait, if extension.ts sets baseline to `04-07`, 
    // `firstDateStr` is `04-07`. When we process `04-07`, `previousAbsolute` starts at 0. 
    // But `augmentedUsage[firstDateStr]` is 60. So `04-07` usage is 60 - 0 = 60. This matches exactly!
    
    let lastKnownValue = 0; // We will pick up from the first element
    if (augmentedUsage[firstDateStr] !== undefined) {
        // Technically, `previousAbsolute` is 0, so the first ever baseline's usage is its full total.
    }

    // But what if the month started normally and dailyUsage started on 04-01?
    // Then 04-01 will show its full total usage, since previousAbsolute is 0. That's also correct for 04-01!

    while (processDateObj <= endDateObj) {
        const cStr = `${processDateObj.getFullYear()}-${String(processDateObj.getMonth() + 1).padStart(2, '0')}-${String(processDateObj.getDate()).padStart(2, '0')}`;
        
        if (augmentedUsage[cStr] !== undefined) {
             lastKnownValue = augmentedUsage[cStr];
        }
        
        const diff = lastKnownValue - previousAbsolute;
        const pct = (diff / monthlyLimit) * 100;
        
        const mm = String(processDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(processDateObj.getDate()).padStart(2, '0');
        const displayDate = `${mm}-${dd}`;
        
        // Remove trailing .0
        let pctStr = pct.toFixed(1);
        if (pctStr.endsWith(".0")) {
             pctStr = Math.round(pct).toString();
        }
        
        messageLines.push(`${displayDate}: ${pctStr}%`);
        
        previousAbsolute = lastKnownValue;
        processDateObj.setDate(processDateObj.getDate() + 1);
    }

    vscode.window.showInformationMessage(messageLines.join("\n"), { modal: true });
}
