import * as assert from 'assert';
import * as quotaCalculator from '../../quota-calculator';

suite('Quota Calculator Test Suite', () => {
    test('getWorkingDaysInMonth - March 2026', () => {
        // March 2026 has 22 working days (Mon-Fri)
        assert.strictEqual(quotaCalculator.getWorkingDaysInMonth(2026, 2), 22);
    });

    test('getWorkingDaysInMonth - February 2026', () => {
        // February 2026 has 20 working days
        assert.strictEqual(quotaCalculator.getWorkingDaysInMonth(2026, 1), 20);
    });

    test('getWorkingDayOfMonth - testing various dates in March 2026', () => {
        // March 1st 2026 is Sunday -> 0 working days
        assert.strictEqual(quotaCalculator.getWorkingDayOfMonth(new Date(2026, 2, 1)), 0);

        // March 2nd 2026 is Monday -> 1st working day
        assert.strictEqual(quotaCalculator.getWorkingDayOfMonth(new Date(2026, 2, 2)), 1);

        // March 6th 2026 is Friday -> 5th working day
        assert.strictEqual(quotaCalculator.getWorkingDayOfMonth(new Date(2026, 2, 6)), 5);

        // March 7th 2026 is Saturday -> still 5th working day
        assert.strictEqual(quotaCalculator.getWorkingDayOfMonth(new Date(2026, 2, 7)), 5);

        // March 9th 2026 is Monday -> 6th working day
        assert.strictEqual(quotaCalculator.getWorkingDayOfMonth(new Date(2026, 2, 9)), 6);
    });

    test('calculateDailyQuotaPercent', () => {
        assert.strictEqual(quotaCalculator.calculateDailyQuotaPercent(20), 5);
        assert.strictEqual(quotaCalculator.calculateDailyQuotaPercent(25), 4);
    });

    test('calculateSafeQuotaPercent', () => {
        // Day 5 of 20 -> 25%
        assert.strictEqual(quotaCalculator.calculateSafeQuotaPercent(20, 5), 25);
        // Day 11 of 22 -> 50%
        assert.strictEqual(quotaCalculator.calculateSafeQuotaPercent(22, 11), 50);
    });

    test('shouldAlert - with threshold', () => {
        // Safe: 25%, Usage: 30%, Threshold: 0 -> Alert
        assert.strictEqual(quotaCalculator.shouldAlert(30, 25, 0), true);

        // Safe: 25%, Usage: 30%, Threshold: 10 -> No Alert (30 < 25+10)
        assert.strictEqual(quotaCalculator.shouldAlert(30, 25, 10), false);

        // Safe: 25%, Usage: 22%, Threshold: -5 -> Alert (22 > 25-5)
        assert.strictEqual(quotaCalculator.shouldAlert(22, 25, -5), true);
    });

    test('computeQuotaSummary logic check', () => {
        const now = new Date(2026, 2, 13); // Friday, March 13th 2026
        // Total working days in March 2026: 22
        // Working day of March 13th: 10 (2,3,4,5,6, 9,10,11,12,13)
        // Safe quota: 10 / 22 * 100 = 45.45...%

        const summary = quotaCalculator.computeQuotaSummary(100, 300, 0, 0, now);

        assert.strictEqual(summary.totalWorkingDays, 22);
        assert.strictEqual(summary.currentWorkingDay, 10);
        assert.strictEqual(summary.usedRequests, 100);
        assert.strictEqual(summary.monthlyLimit, 300);
        assert.strictEqual(Math.round(summary.usagePercent), 33); // 100/300 = 33.33%
        assert.strictEqual(summary.isOverBudget, false); // 33.33% < 45.45%
    });

    test('computeQuotaSummary logic check - with extra holiday', () => {
        const now = new Date(2026, 2, 13); // Friday, March 13th 2026
        // Total working days in March 2026: 22
        // Extra holidays: 2 -> Total working days: 20
        // Working day of March 13th: 10
        // Safe quota: 10 / 20 * 100 = 50%

        const summary = quotaCalculator.computeQuotaSummary(100, 300, 0, 2, now);

        assert.strictEqual(summary.totalWorkingDays, 20);
        assert.strictEqual(summary.currentWorkingDay, 10);
        assert.strictEqual(summary.usedRequests, 100);
        assert.strictEqual(summary.monthlyLimit, 300);
        assert.strictEqual(Math.round(summary.usagePercent), 33); // 100/300 = 33.33%
        assert.strictEqual(summary.isOverBudget, false); // 33.33% < 50%
    });
});
