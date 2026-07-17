/**
 * GitHub API integration for fetching Copilot GitHub AI Credit usage.
 *
 * Data-source strategy:
 * 1. Internal API (`/copilot_internal/user`) — near real-time, but only
 *    accepted when GitHub explicitly marks the snapshot as token-based billing.
 * 2. AI credit billing API (`/users/{username}/settings/billing/ai_credit/usage`)
 *    — official fallback.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Represents fetched Copilot usage regardless of which API provided it. */
export interface CopilotUsage {
    usedAiCredits: number;
    monthlyAiCreditLimit: number;
    /** Start of the current billing period (UTC midnight). */
    periodStart: Date;
    /** End of the current billing period (UTC midnight). */
    periodEnd: Date;
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/** GitHub API returned 401 — the token has expired or been revoked. */
export class TokenExpiredError extends Error {
    constructor() {
        super("GitHub token is invalid or has been revoked (401)");
        this.name = "TokenExpiredError";
    }
}

/** GitHub API returned 404 — the resource was not found. */
export class NotFoundError extends Error {
    constructor(url: string) {
        super(`GitHub resource not found: ${url}`);
        this.name = "NotFoundError";
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITHUB_API_HEADERS = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "vscode-copilot-quota-alert/2.0.0",
});

/** Maps common HTTP error codes to typed errors. */
function throwOnHttpError(response: Response, url: string): void {
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
export async function fetchUsername(token: string): Promise<string> {
    const url = "https://api.github.com/user";
    const response = await fetch(url, { headers: GITHUB_API_HEADERS(token) });
    throwOnHttpError(response, url);
    const data = (await response.json()) as any;
    return data.login as string;
}

/**
 * Returns the UTC calendar-month billing period containing `now`.
 * GitHub AI Credit allowances reset at 00:00 UTC on the first of each month.
 */
function getUtcBillingPeriod(now: Date): {
    periodStart: Date;
    periodEnd: Date;
} {
    return {
        periodStart: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        ),
        periodEnd: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
        ),
    };
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/**
 * Fetches AI credit usage from the **internal** API (near real-time).
 * Endpoint: GET /copilot_internal/user
 *
 * GitHub retained the historical `premium_interactions` response key after
 * changing billing models. The values are interpreted as AI credits only when
 * `token_based_billing` is explicitly true, preventing legacy premium request
 * counts from being mislabeled as credits. The usable monthly total is the
 * included entitlement plus any finite pay-as-you-go overage entitlement. A
 * direct `credits_used` value takes precedence over reconstructing usage from
 * the remaining balance.
 */
export async function fetchCopilotInternalAiCredits(
    token: string
): Promise<CopilotUsage> {
    const url = "https://api.github.com/copilot_internal/user";
    const response = await fetch(url, { headers: GITHUB_API_HEADERS(token) });
    throwOnHttpError(response, url);

    const data = (await response.json()) as {
        token_based_billing?: boolean;
        quota_reset_date_utc?: string;
        quota_snapshots?: {
            premium_interactions?: {
                token_based_billing?: boolean;
                entitlement?: number;
                credits_used?: number;
                quota_remaining?: number;
                remaining?: number;
                overage_count?: number;
                /** Finite pay-as-you-go budget, expressed in AI credits. */
                overage_entitlement?: number;
                unlimited?: boolean;
                quota_reset_at?: number;
            };
        };
    };
    const premium = data.quota_snapshots?.premium_interactions;
    const isTokenBased =
        data.token_based_billing === true || premium?.token_based_billing === true;

    if (!premium || !isTokenBased) {
        throw new Error("Internal API did not return token-based AI Credit usage");
    }
    if (premium.unlimited || !isFiniteNumber(premium.entitlement) || premium.entitlement <= 0) {
        throw new Error("Internal API did not return a finite AI Credit allowance");
    }

    const overage = isFiniteNumber(premium.overage_count)
        ? Math.max(0, premium.overage_count)
        : 0;
    const overageEntitlement = isFiniteNumber(premium.overage_entitlement)
        ? Math.max(0, premium.overage_entitlement)
        : 0;
    let usedAiCredits: number;
    if (isFiniteNumber(premium.credits_used)) {
        usedAiCredits = Math.max(0, premium.credits_used);
    } else {
        const remaining = isFiniteNumber(premium.quota_remaining)
            ? premium.quota_remaining
            : premium.remaining;
        if (!isFiniteNumber(remaining)) {
            throw new Error("Internal API did not return used or remaining AI Credits");
        }
        usedAiCredits = Math.max(
            0,
            premium.entitlement - remaining + overage
        );
    }
    const totalAiCreditLimit = premium.entitlement + overageEntitlement;

    const resetValue = data.quota_reset_date_utc
        ?? (isFiniteNumber(premium.quota_reset_at)
            ? new Date(premium.quota_reset_at * 1000).toISOString()
            : undefined);
    const parsedPeriodEnd = resetValue ? new Date(resetValue) : undefined;
    const fallbackPeriod = getUtcBillingPeriod(new Date());
    const periodEnd = parsedPeriodEnd && !Number.isNaN(parsedPeriodEnd.getTime())
        ? parsedPeriodEnd
        : fallbackPeriod.periodEnd;
    const periodStart = new Date(
        Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() - 1, 1)
    );

    return {
        usedAiCredits,
        monthlyAiCreditLimit: totalAiCreditLimit,
        periodStart,
        periodEnd,
    };
}

/**
 * Fetches Copilot AI credit usage from the official billing API.
 * Endpoint: GET /users/{username}/settings/billing/ai_credit/usage
 *
 * Each usage item represents a model or product slice. `grossQuantity` is the
 * amount consumed before included-credit discounts, so all items must be
 * summed to measure allowance consumption.
 */
export async function fetchCopilotAiCreditBilling(
    token: string,
    username: string,
    monthlyAiCreditLimit: number,
    now: Date = new Date()
): Promise<CopilotUsage> {
    const encodedUsername = encodeURIComponent(username);
    const url = new URL(
        `https://api.github.com/users/${encodedUsername}/settings/billing/ai_credit/usage`
    );
    url.searchParams.set("year", String(now.getUTCFullYear()));
    url.searchParams.set("month", String(now.getUTCMonth() + 1));
    const response = await fetch(url.toString(), {
        headers: GITHUB_API_HEADERS(token),
    });
    throwOnHttpError(response, url.toString());

    const data = (await response.json()) as {
        usageItems?: Array<{ grossQuantity?: number }>;
    };
    const usedAiCredits = (data.usageItems ?? []).reduce(
        (total, item) => total + (
            isFiniteNumber(item.grossQuantity)
                ? Math.max(0, item.grossQuantity)
                : 0
        ),
        0
    );

    const { periodStart, periodEnd } = getUtcBillingPeriod(now);

    return {
        usedAiCredits,
        monthlyAiCreditLimit,
        periodStart,
        periodEnd,
    };
}
