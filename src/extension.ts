/**
 * Copilot Quota Alert – VS Code Extension
 *
 * Monitors GitHub Copilot Premium Request usage and alerts the user
 * when their consumption exceeds a calculated "safe daily quota"
 * based on working days in the month.
 */

import * as vscode from "vscode";
import {
    fetchCopilotInternal,
    fetchCopilotBilling,
    fetchUsername,
    TokenExpiredError,
    NotFoundError,
    type CopilotUsage,
} from "./github-api";
import { computeQuotaSummary } from "./quota-calculator";
import {
    createStatusBarItem,
    showNoToken,
    showLoading,
    showError,
    showTokenExpired,
    updateStatusBar,
    showQuotaDetails,
} from "./status-bar";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let secretStorage: vscode.SecretStorage;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let lastSummary:
    | ReturnType<typeof computeQuotaSummary>
    | undefined;

const DEFAULT_MONTHLY_LIMIT = 300;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Resolves a GitHub OAuth token using the following priority:
 *   1. An existing VS Code ↔ GitHub session (silent — no user prompt).
 *   2. A manually stored GitHub PAT from SecretStorage.
 *
 * Returns `undefined` if neither source yields a token.
 */
async function getToken(): Promise<{ token: string; source: "session" | "pat" } | undefined> {
    // 1. Try the VS Code GitHub session (silent — never prompts the user).
    try {
        const session = await vscode.authentication.getSession(
            "github",
            ["read:user", "copilot"],
            { silent: true }
        );
        if (session?.accessToken) {
            return { token: session.accessToken, source: "session" };
        }
    } catch {
        // Session provider unavailable — fall through to PAT.
    }

    // 2. Fall back to the stored PAT.
    const pat = await secretStorage.get("copilot-quota-alert.githubToken");
    if (pat) {
        return { token: pat, source: "pat" };
    }

    return undefined;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
    console.log("Copilot Quota Alert activated");

    secretStorage = context.secrets;
    createStatusBarItem(context);

    // --- Register commands ---------------------------------------------------

    // Set GitHub PAT (stored securely in VS Code's encrypted SecretStorage)
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "copilot-quota-alert.setToken",
            async () => {
                const token = await vscode.window.showInputBox({
                    prompt:
                        "Enter your GitHub Personal Access Token (needs copilot or Plan:read scope)",
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
                    vscode.window.showInformationMessage(
                        "Copilot Quota Alert: Token saved. Refreshing quota..."
                    );
                    updateQuota();
                }
            }
        )
    );

    // Manual refresh
    context.subscriptions.push(
        vscode.commands.registerCommand("copilot-quota-alert.refresh", () => {
            updateQuota();
        })
    );

    // Show detailed quota info
    context.subscriptions.push(
        vscode.commands.registerCommand("copilot-quota-alert.checkQuota", () => {
            if (lastSummary) {
                showQuotaDetails(lastSummary);
            } else {
                updateQuota();
            }
        })
    );

    // --- Listen for configuration changes -----------------------------------
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("copilot-quota-alert")) {
                restartRefreshTimer();
                updateQuota();
            }
        })
    );

    // --- Initial fetch & auto-refresh timer ----------------------------------
    updateQuota();
    startRefreshTimer();
}

// ---------------------------------------------------------------------------
// Refresh timer management
// ---------------------------------------------------------------------------

function getRefreshIntervalMs(): number {
    const config = vscode.workspace.getConfiguration("copilot-quota-alert");
    const minutes = config.get<number>("refreshIntervalMinutes") ?? 5;
    return Math.max(1, minutes) * 60 * 1000;
}

function startRefreshTimer(): void {
    refreshTimer = setInterval(updateQuota, getRefreshIntervalMs());
}

function restartRefreshTimer(): void {
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
async function updateQuota(): Promise<void> {
    showLoading();

    try {
        const auth = await getToken();

        if (!auth) {
            showNoToken();
            return;
        }

        const { token, source } = auth;

        // --- Fetch usage data --------------------------------------------------
        let usage: CopilotUsage;
        try {
            usage = await fetchCopilotInternal(token);
        } catch (internalError) {
            // Re-throw auth errors immediately
            if (internalError instanceof TokenExpiredError) {
                throw internalError;
            }

            // Internal API unavailable — fall back to billing API
            const config = vscode.workspace.getConfiguration("copilot-quota-alert");

            let monthlyLimit =
                config.get<number>("monthlyLimit") ?? DEFAULT_MONTHLY_LIMIT;
            if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
                monthlyLimit = DEFAULT_MONTHLY_LIMIT;
            }

            let username = config.get<string>("username")?.trim();
            if (!username) {
                username = await fetchUsername(token);
                await config.update(
                    "username",
                    username,
                    vscode.ConfigurationTarget.Global
                );
            }

            try {
                usage = await fetchCopilotBilling(token, username, monthlyLimit);
            } catch (billingError) {
                if (billingError instanceof NotFoundError) {
                    // Cached username is likely wrong — re-resolve
                    await config.update(
                        "username",
                        undefined,
                        vscode.ConfigurationTarget.Global
                    );
                    const freshUsername = await fetchUsername(token);
                    await config.update(
                        "username",
                        freshUsername,
                        vscode.ConfigurationTarget.Global
                    );
                    usage = await fetchCopilotBilling(
                        token,
                        freshUsername,
                        monthlyLimit
                    );
                } else {
                    throw billingError;
                }
            }
        }

        // --- Calculate & display -----------------------------------------------
        const config = vscode.workspace.getConfiguration("copilot-quota-alert");
        const thresholdPercent = config.get<number>("thresholdPercent") ?? 0;

        const summary = computeQuotaSummary(
            usage.usedRequests,
            usage.monthlyLimit,
            thresholdPercent
        );

        lastSummary = summary;
        updateStatusBar(summary, source);
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            // Only remove the stored PAT if that was actually what we used.
            // A session token cannot be deleted from our side.
            const auth = await getToken();
            if (!auth || auth.source === "pat") {
                await secretStorage.delete("copilot-quota-alert.githubToken");
            }
            showTokenExpired();
        } else {
            console.error("Copilot Quota Alert error:", error);
            showError(
                error instanceof Error ? error.message : "Unknown error occurred"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }
}
