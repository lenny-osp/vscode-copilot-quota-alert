"use strict";
/**
 * Status bar UI management for the Copilot Quota Alert extension.
 *
 * Displays a status bar item with current usage vs safe quota,
 * color-coded to indicate whether the user is on track or over budget.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStatusBarItem = createStatusBarItem;
exports.showNoToken = showNoToken;
exports.showLoading = showLoading;
exports.showError = showError;
exports.showTokenExpired = showTokenExpired;
exports.updateStatusBar = updateStatusBar;
exports.showQuotaDetails = showQuotaDetails;
const vscode = __importStar(require("vscode"));
let statusBarItem;
// Track the last alert date so we only show the warning dialog once per day
let lastAlertDate;
/**
 * Creates and returns the status bar item. Call once during activation.
 */
function createStatusBarItem(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    return statusBarItem;
}
/**
 * Shows a "no token" prompt in the status bar.
 */
function showNoToken() {
    if (!statusBarItem) {
        return;
    }
    statusBarItem.text = "$(key) Copilot Quota: Set Token";
    statusBarItem.tooltip = "Click to set your GitHub Personal Access Token";
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.command = "copilot-quota-alert.setToken";
}
/**
 * Shows a loading spinner in the status bar.
 */
function showLoading() {
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
function showError(message) {
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
function showTokenExpired() {
    if (!statusBarItem) {
        return;
    }
    statusBarItem.text = "$(key) Copilot Quota: Token Expired";
    statusBarItem.tooltip =
        "Your GitHub token is invalid or revoked. Click to set a new one.";
    statusBarItem.color = undefined;
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    statusBarItem.command = "copilot-quota-alert.setToken";
}
/**
 * Updates the status bar with the current quota summary.
 * Also triggers an alert dialog if the user is over budget.
 */
function updateStatusBar(summary) {
    if (!statusBarItem) {
        return;
    }
    const usagePct = summary.usagePercent.toFixed(1);
    const safePct = summary.safeQuotaPercent.toFixed(1);
    if (summary.isOverBudget) {
        statusBarItem.text = `$(warning) Copilot: ${usagePct}% / ${safePct}%`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        statusBarItem.color = undefined;
    }
    else {
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
function showAlertDialog(summary) {
    const today = new Date().toISOString().slice(0, 10);
    if (lastAlertDate === today) {
        return; // Already alerted today
    }
    lastAlertDate = today;
    const usagePct = summary.usagePercent.toFixed(1);
    const safePct = summary.safeQuotaPercent.toFixed(1);
    vscode.window.showWarningMessage(`Copilot Quota Alert: Your usage (${usagePct}%) exceeds today's safe quota (${safePct}%). ` +
        `You're on working day ${summary.currentWorkingDay} of ${summary.totalWorkingDays}. ` +
        `Consider reducing premium request usage to stay within budget.`, "OK", "Don't alert today");
}
/**
 * Shows a detailed information dialog with full quota breakdown.
 */
function showQuotaDetails(summary) {
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
    }
    else {
        vscode.window.showInformationMessage(message);
    }
}
//# sourceMappingURL=status-bar.js.map