import * as assert from 'assert';
import * as vscode from 'vscode';
import { createStatusBarItem, updateStatusBar } from '../../status-bar';
import type { QuotaSummary } from '../../quota-calculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal fake ExtensionContext sufficient to initialise the status bar. */
function makeFakeContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
    } as unknown as vscode.ExtensionContext;
}

/** A QuotaSummary that won't trigger any alert dialogs (not over budget). */
const SAFE_SUMMARY: QuotaSummary = {
    usedRequests: 50,
    monthlyLimit: 300,
    usagePercent: (50 / 300) * 100,
    totalWorkingDays: 22,
    currentWorkingDay: 10,
    dailyQuotaPercent: 100 / 22,
    safeQuotaPercent: (10 / 22) * 100,
    isOverBudget: false,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

suite('Status Bar Test Suite', () => {
    let item: vscode.StatusBarItem;

    setup(() => {
        item = createStatusBarItem(makeFakeContext());
    });

    teardown(() => {
        item.dispose();
    });

    test('tooltip contains "Auth: VS Code GitHub session" when authSource is "session"', () => {
        updateStatusBar(SAFE_SUMMARY, 'session');
        const tooltip = item.tooltip as string;
        assert.ok(
            tooltip.includes('Auth: VS Code GitHub session'),
            `Expected tooltip to contain auth source line, got:\n${tooltip}`
        );
    });

    test('tooltip contains "Auth: Personal Access Token" when authSource is "pat"', () => {
        updateStatusBar(SAFE_SUMMARY, 'pat');
        const tooltip = item.tooltip as string;
        assert.ok(
            tooltip.includes('Auth: Personal Access Token'),
            `Expected tooltip to contain auth source line, got:\n${tooltip}`
        );
    });

    test('tooltip does not contain "Auth:" when authSource is undefined', () => {
        updateStatusBar(SAFE_SUMMARY, undefined);
        const tooltip = item.tooltip as string;
        assert.ok(
            !tooltip.includes('Auth:'),
            `Expected tooltip to have no auth source line, got:\n${tooltip}`
        );
    });

    test('status bar text shows check icon when on budget', () => {
        updateStatusBar(SAFE_SUMMARY, 'session');
        assert.ok(
            item.text.includes('$(check)'),
            `Expected check icon in status bar text, got: ${item.text}`
        );
    });

    test('status bar text shows warning icon when over budget', () => {
        const overBudgetSummary: QuotaSummary = {
            ...SAFE_SUMMARY,
            usedRequests: 250,
            usagePercent: (250 / 300) * 100,
            isOverBudget: true,
        };
        updateStatusBar(overBudgetSummary, 'session');
        assert.ok(
            item.text.includes('$(warning)'),
            `Expected warning icon in status bar text, got: ${item.text}`
        );
    });
});
