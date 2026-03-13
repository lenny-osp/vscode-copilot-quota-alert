"use strict";
/**
 * GitHub API integration for fetching Copilot premium request usage.
 *
 * Data-source strategy:
 * 1. Internal API (`/copilot_internal/user`) — near real-time, returns entitlement + remaining
 * 2. Billing API (`/users/{username}/settings/billing/usage/summary`) — official fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.TokenExpiredError = void 0;
exports.fetchUsername = fetchUsername;
exports.fetchCopilotInternal = fetchCopilotInternal;
exports.fetchCopilotBilling = fetchCopilotBilling;
// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------
/** GitHub API returned 401 — the token has expired or been revoked. */
class TokenExpiredError extends Error {
    constructor() {
        super("GitHub token is invalid or has been revoked (401)");
        this.name = "TokenExpiredError";
    }
}
exports.TokenExpiredError = TokenExpiredError;
/** GitHub API returned 404 — the resource was not found. */
class NotFoundError extends Error {
    constructor(url) {
        super(`GitHub resource not found: ${url}`);
        this.name = "NotFoundError";
    }
}
exports.NotFoundError = NotFoundError;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GITHUB_API_HEADERS = (token) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "vscode-copilot-quota-alert/0.1.0",
});
/** Maps common HTTP error codes to typed errors. */
function throwOnHttpError(response, url) {
    if (response.ok) {
        return;
    }
    if (response.status === 401) {
        throw new TokenExpiredError();
    }
    if (response.status === 404) {
        throw new NotFoundError(url);
    }
    throw new Error(`GitHub API ${response.status}: ${url}`);
}
// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------
/** Resolves the authenticated user's login name from the GitHub API. */
async function fetchUsername(token) {
    const url = "https://api.github.com/user";
    const response = await fetch(url, { headers: GITHUB_API_HEADERS(token) });
    throwOnHttpError(response, url);
    const data = (await response.json());
    return data.login;
}
/**
 * Fetches Copilot usage from the **internal** API (near real-time).
 * Endpoint: GET /copilot_internal/user
 *
 * This is an undocumented GitHub API that returns accurate quota snapshots
 * including `premium_interactions` with remaining/entitlement data and the
 * billing period reset date.
 */
async function fetchCopilotInternal(token) {
    const url = "https://api.github.com/copilot_internal/user";
    const response = await fetch(url, { headers: GITHUB_API_HEADERS(token) });
    throwOnHttpError(response, url);
    const data = (await response.json());
    const premium = data.quota_snapshots?.premium_interactions;
    if (!premium || premium.unlimited) {
        throw new Error("No premium_interactions quota in internal API response");
    }
    const entitlement = premium.entitlement;
    const remaining = premium.quota_remaining;
    const periodEnd = new Date(data.quota_reset_date_utc);
    const periodStart = new Date(periodEnd);
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
    return {
        usedRequests: entitlement - remaining,
        monthlyLimit: entitlement,
        periodStart,
        periodEnd,
    };
}
/**
 * Fetches Copilot usage from the **billing** API (official, may lag behind).
 * Endpoint: GET /users/{username}/settings/billing/usage/summary
 */
async function fetchCopilotBilling(token, username, monthlyLimit) {
    const url = `https://api.github.com/users/${username}/settings/billing/usage/summary`;
    const response = await fetch(url, { headers: GITHUB_API_HEADERS(token) });
    throwOnHttpError(response, url);
    const data = (await response.json());
    const copilotItem = data.usageItems?.find((item) => item.sku === "copilot_premium_request");
    const usedRequests = copilotItem ? copilotItem.grossQuantity : 0;
    // Billing API doesn't expose period dates — assume calendar month (UTC)
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { usedRequests, monthlyLimit, periodStart, periodEnd };
}
//# sourceMappingURL=github-api.js.map