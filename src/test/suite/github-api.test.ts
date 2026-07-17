import * as assert from 'assert';
import {
    fetchCopilotAiCreditBilling,
    fetchCopilotInternalAiCredits,
    fetchUsername,
    TokenExpiredError,
} from '../../github-api';

suite('GitHub API Test Suite', () => {
    const originalFetch = globalThis.fetch;

    teardown(() => {
        globalThis.fetch = originalFetch;
    });

    test('fetchUsername uses the current GitHub API version', async () => {
        let request: { url?: string; init?: RequestInit } = {};
        globalThis.fetch = (async (url, init) => {
            request = { url: String(url), init };
            return new Response(JSON.stringify({ login: 'octocat' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }) as typeof fetch;

        assert.strictEqual(await fetchUsername('test-token'), 'octocat');
        assert.strictEqual(request.url, 'https://api.github.com/user');
        assert.strictEqual(
            (request.init?.headers as Record<string, string>)['X-GitHub-Api-Version'],
            '2026-03-10'
        );
    });

    test('internal endpoint reads fractional AI credits only for token billing', async () => {
        globalThis.fetch = (async () => new Response(JSON.stringify({
            token_based_billing: true,
            quota_reset_date_utc: '2026-08-01T00:00:00.000Z',
            quota_snapshots: {
                premium_interactions: {
                    entitlement: 1000,
                    quota_remaining: 700.25,
                    overage_count: 0.75,
                    unlimited: false,
                },
            },
        }), { status: 200 })) as typeof fetch;

        const usage = await fetchCopilotInternalAiCredits('test-token', 1500);

        assert.strictEqual(usage.usedAiCredits, 300.5);
        // The internal snapshot can expose only base credits. Quota pacing must
        // retain the configured total allowance, which includes flex credits.
        assert.strictEqual(usage.monthlyAiCreditLimit, 1500);
        assert.strictEqual(usage.periodStart.toISOString(), '2026-07-01T00:00:00.000Z');
        assert.strictEqual(usage.periodEnd.toISOString(), '2026-08-01T00:00:00.000Z');
    });

    test('internal endpoint rejects legacy premium request snapshots', async () => {
        globalThis.fetch = (async () => new Response(JSON.stringify({
            token_based_billing: false,
            quota_snapshots: {
                premium_interactions: {
                    entitlement: 300,
                    quota_remaining: 200,
                    unlimited: false,
                },
            },
        }), { status: 200 })) as typeof fetch;

        await assert.rejects(
            fetchCopilotInternalAiCredits('test-token', 1500),
            /did not return token-based AI Credit usage/
        );
    });

    test('official endpoint sums AI credit usage across models', async () => {
        let requestedUrl = '';
        globalThis.fetch = (async (url) => {
            requestedUrl = String(url);
            return new Response(JSON.stringify({
                usageItems: [
                    { model: 'GPT-5', grossQuantity: 100.25 },
                    { model: 'Claude Sonnet 5', grossQuantity: 49.75 },
                    { model: 'ignored-invalid-item', grossQuantity: '10' },
                ],
            }), { status: 200 });
        }) as typeof fetch;

        const usage = await fetchCopilotAiCreditBilling(
            'test-token',
            'octo cat',
            7000,
            new Date('2026-07-17T12:00:00.000Z')
        );

        assert.strictEqual(
            requestedUrl,
            'https://api.github.com/users/octo%20cat/settings/billing/ai_credit/usage?year=2026&month=7'
        );
        assert.strictEqual(usage.usedAiCredits, 150);
        assert.strictEqual(usage.monthlyAiCreditLimit, 7000);
        assert.strictEqual(usage.periodStart.toISOString(), '2026-07-01T00:00:00.000Z');
        assert.strictEqual(usage.periodEnd.toISOString(), '2026-08-01T00:00:00.000Z');
    });

    test('HTTP 401 maps to TokenExpiredError', async () => {
        globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;

        await assert.rejects(
            fetchCopilotAiCreditBilling('expired', 'octocat', 1500),
            TokenExpiredError
        );
    });
});
