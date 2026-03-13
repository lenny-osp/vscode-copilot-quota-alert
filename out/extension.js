"use strict";
/**
 * Copilot Quota Alert – VS Code Extension
 *
 * Monitors GitHub Copilot Premium Request usage and alerts the user
 * when their consumption exceeds a calculated "safe daily quota"
 * based on working days in the month.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const github_api_1 = require("./github-api");
const quota_calculator_1 = require("./quota-calculator");
const status_bar_1 = require("./status-bar");
// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
let secretStorage;
let refreshTimer;
let lastSummary;
const DEFAULT_MONTHLY_LIMIT = 300;
// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------
function activate(context) {
    console.log("Copilot Quota Alert activated");
    secretStorage = context.secrets;
    (0, status_bar_1.createStatusBarItem)(context);
    // --- Register commands ---------------------------------------------------
    // Set GitHub PAT (stored securely in VS Code's encrypted SecretStorage)
    context.subscriptions.push(vscode.commands.registerCommand("copilot-quota-alert.setToken", async () => {
        const token = await vscode.window.showInputBox({
            prompt: "Enter your GitHub Personal Access Token (needs copilot or Plan:read scope)",
            password: true,
            validateInput: (value) => {
                const trimmed = value.trim();
                if (trimmed === "") {
                    return "Token cannot be empty.";
                }
                if (!/^(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9_]{36}$|^github_pat_[a-zA-Z0-9_]{82}$/.test(trimmed)) {
                    return "Invalid GitHub token format.";
                }
                return null; // Valid
            }
        });
        if (token !== undefined && token.trim() !== "") {
            await secretStorage.store("copilot-quota-alert.githubToken", token.trim());
            vscode.window.showInformationMessage("Copilot Quota Alert: Token saved. Refreshing quota...");
            updateQuota();
        }
    }));
    // Manual refresh
    context.subscriptions.push(vscode.commands.registerCommand("copilot-quota-alert.refresh", () => {
        updateQuota();
    }));
    // Show detailed quota info
    context.subscriptions.push(vscode.commands.registerCommand("copilot-quota-alert.checkQuota", () => {
        if (lastSummary) {
            (0, status_bar_1.showQuotaDetails)(lastSummary);
        }
        else {
            updateQuota();
        }
    }));
    // --- Listen for configuration changes -----------------------------------
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("copilot-quota-alert")) {
            restartRefreshTimer();
            updateQuota();
        }
    }));
    // --- Initial fetch & auto-refresh timer ----------------------------------
    updateQuota();
    startRefreshTimer();
}
// ---------------------------------------------------------------------------
// Refresh timer management
// ---------------------------------------------------------------------------
function getRefreshIntervalMs() {
    const config = vscode.workspace.getConfiguration("copilot-quota-alert");
    const minutes = config.get("refreshIntervalMinutes") ?? 5;
    return Math.max(1, minutes) * 60 * 1000;
}
function startRefreshTimer() {
    refreshTimer = setInterval(updateQuota, getRefreshIntervalMs());
}
function restartRefreshTimer() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    startRefreshTimer();
}
// ---------------------------------------------------------------------------
// Main update cycle
// ---------------------------------------------------------------------------
/**
 * Main refresh cycle: fetch usage → calculate → update UI.
 *
 * Data-source strategy:
 * 1. Try the internal Copilot API first (near real-time, no username needed).
 * 2. If that fails, fall back to the official billing API.
 *
 * Self-healing behaviour:
 * - Missing token → prompts the user
 * - Token expired (401) → clears token, prompts for a new one
 * - Username not found (404) → re-resolves from API
 */
async function updateQuota() {
    (0, status_bar_1.showLoading)();
    try {
        const token = await secretStorage.get("copilot-quota-alert.githubToken");
        if (!token) {
            (0, status_bar_1.showNoToken)();
            return;
        }
        // --- Fetch usage data --------------------------------------------------
        let usage;
        try {
            usage = await (0, github_api_1.fetchCopilotInternal)(token);
        }
        catch (internalError) {
            // Re-throw auth errors immediately
            if (internalError instanceof github_api_1.TokenExpiredError) {
                throw internalError;
            }
            // Internal API unavailable — fall back to billing API
            const config = vscode.workspace.getConfiguration("copilot-quota-alert");
            let monthlyLimit = config.get("monthlyLimit") ?? DEFAULT_MONTHLY_LIMIT;
            if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
                monthlyLimit = DEFAULT_MONTHLY_LIMIT;
            }
            let username = config.get("username")?.trim();
            if (!username) {
                username = await (0, github_api_1.fetchUsername)(token);
                await config.update("username", username, vscode.ConfigurationTarget.Global);
            }
            try {
                usage = await (0, github_api_1.fetchCopilotBilling)(token, username, monthlyLimit);
            }
            catch (billingError) {
                if (billingError instanceof github_api_1.NotFoundError) {
                    // Cached username is likely wrong — re-resolve
                    await config.update("username", undefined, vscode.ConfigurationTarget.Global);
                    const freshUsername = await (0, github_api_1.fetchUsername)(token);
                    await config.update("username", freshUsername, vscode.ConfigurationTarget.Global);
                    usage = await (0, github_api_1.fetchCopilotBilling)(token, freshUsername, monthlyLimit);
                }
                else {
                    throw billingError;
                }
            }
        }
        // --- Calculate & display -----------------------------------------------
        const config = vscode.workspace.getConfiguration("copilot-quota-alert");
        const thresholdPercent = config.get("thresholdPercent") ?? 0;
        const summary = (0, quota_calculator_1.computeQuotaSummary)(usage.usedRequests, usage.monthlyLimit, thresholdPercent);
        lastSummary = summary;
        (0, status_bar_1.updateStatusBar)(summary);
    }
    catch (error) {
        if (error instanceof github_api_1.TokenExpiredError) {
            await secretStorage.delete("copilot-quota-alert.githubToken");
            (0, status_bar_1.showTokenExpired)();
        }
        else {
            console.error("Copilot Quota Alert error:", error);
            (0, status_bar_1.showError)(error instanceof Error ? error.message : "Unknown error occurred");
        }
    }
}
// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------
function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }
}
//# sourceMappingURL=extension.js.map