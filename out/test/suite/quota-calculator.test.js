"use strict";
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
const assert = __importStar(require("assert"));
const quotaCalculator = __importStar(require("../../quota-calculator"));
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
        const summary = quotaCalculator.computeQuotaSummary(100, 300, 0, now);
        assert.strictEqual(summary.totalWorkingDays, 22);
        assert.strictEqual(summary.currentWorkingDay, 10);
        assert.strictEqual(summary.usedRequests, 100);
        assert.strictEqual(summary.monthlyLimit, 300);
        assert.strictEqual(Math.round(summary.usagePercent), 33); // 100/300 = 33.33%
        assert.strictEqual(summary.isOverBudget, false); // 33.33% < 45.45%
    });
});
//# sourceMappingURL=quota-calculator.test.js.map