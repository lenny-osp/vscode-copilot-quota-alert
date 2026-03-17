/**
 * Status bar UI management for the Copilot Quota Alert extension.
 *
 * Displays a status bar item with current usage vs safe quota,
 * color-coded to indicate whether the user is on track or over budget.
 */

import * as vscode from "vscode";
import type { QuotaSummary } from "./quota-calculator";

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
    ];

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
