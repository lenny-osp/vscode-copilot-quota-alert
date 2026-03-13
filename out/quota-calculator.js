"use strict";
/**
 * Quota calculation logic for working-day-based budget pacing.
 *
 * Core idea:
 * - Count working days (Mon–Fri) in the current month
 * - Divide 100% quota evenly across working days
 * - Calculate the "safe quota" for how far into the month we are
 * - Compare actual usage % against safe quota + user-configured threshold
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkingDaysInMonth = getWorkingDaysInMonth;
exports.getWorkingDayOfMonth = getWorkingDayOfMonth;
exports.calculateDailyQuotaPercent = calculateDailyQuotaPercent;
exports.calculateSafeQuotaPercent = calculateSafeQuotaPercent;
exports.calculateUsagePercent = calculateUsagePercent;
exports.shouldAlert = shouldAlert;
exports.computeQuotaSummary = computeQuotaSummary;
// ---------------------------------------------------------------------------
// Working day calculations
// ---------------------------------------------------------------------------
/**
 * Returns the total number of working days (Mon–Fri) in the given month.
 * @param year  Full year (e.g. 2026)
 * @param month 0-indexed month (0 = January, 11 = December)
 */
function getWorkingDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = new Date(year, month, day).getDay();
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
    }
    return workingDays;
}
/**
 * Returns the 1-indexed working day number for the given date within its month.
 * If the date falls on a weekend, returns the last completed working day number.
 * Returns 0 if no working days have passed yet (e.g. month starts on Saturday
 * and it's still that Saturday).
 *
 * @param date The date to evaluate
 */
function getWorkingDayOfMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = date.getDate();
    let workingDay = 0;
    for (let day = 1; day <= today; day++) {
        const dayOfWeek = new Date(year, month, day).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDay++;
        }
    }
    return workingDay;
}
// ---------------------------------------------------------------------------
// Quota calculations
// ---------------------------------------------------------------------------
/**
 * Calculates the daily quota percentage — the portion of total quota
 * allocated to each working day.
 *
 * @param workingDays Total working days in the month
 * @returns Percentage per working day (e.g. 5.0 for 20 working days)
 */
function calculateDailyQuotaPercent(workingDays) {
    if (workingDays <= 0) {
        return 100;
    }
    return 100 / workingDays;
}
/**
 * Calculates the safe quota percentage for the current working day.
 * This is the maximum usage percentage that keeps you on track.
 *
 * @param workingDays     Total working days in the month
 * @param currentWorkingDay  Current working day number (1-indexed)
 * @returns Safe quota percentage (e.g. 25.0 if day 5 of 20)
 */
function calculateSafeQuotaPercent(workingDays, currentWorkingDay) {
    if (workingDays <= 0) {
        return 100;
    }
    return (currentWorkingDay / workingDays) * 100;
}
/**
 * Calculates current usage as a percentage of the monthly limit.
 *
 * @param usedRequests  Number of premium requests used
 * @param monthlyLimit  Total monthly premium request quota
 * @returns Usage percentage (e.g. 15.0)
 */
function calculateUsagePercent(usedRequests, monthlyLimit) {
    if (monthlyLimit <= 0) {
        return 0;
    }
    return (usedRequests / monthlyLimit) * 100;
}
/**
 * Determines whether the user should be alerted about their quota usage.
 *
 * @param currentUsagePercent  Current usage as a percentage
 * @param safeQuotaPercent     Safe quota for today as a percentage
 * @param thresholdPercent     User-configured threshold offset.
 *                             Positive = more lenient (alert only when further over).
 *                             Negative = more strict (alert before reaching safe quota).
 * @returns true if the user should be alerted
 */
function shouldAlert(currentUsagePercent, safeQuotaPercent, thresholdPercent) {
    return currentUsagePercent > safeQuotaPercent + thresholdPercent;
}
/**
 * Computes a full quota summary from usage data.
 *
 * @param usedRequests  Number of premium requests used
 * @param monthlyLimit  Total monthly premium request quota
 * @param thresholdPercent  User-configured threshold offset
 * @param now           Current date (defaults to now)
 */
function computeQuotaSummary(usedRequests, monthlyLimit, thresholdPercent, now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalWorkingDays = getWorkingDaysInMonth(year, month);
    const currentWorkingDay = getWorkingDayOfMonth(now);
    const dailyQuotaPercent = calculateDailyQuotaPercent(totalWorkingDays);
    const safeQuotaPercent = calculateSafeQuotaPercent(totalWorkingDays, currentWorkingDay);
    const usagePercent = calculateUsagePercent(usedRequests, monthlyLimit);
    const isOverBudget = shouldAlert(usagePercent, safeQuotaPercent, thresholdPercent);
    return {
        usagePercent,
        safeQuotaPercent,
        dailyQuotaPercent,
        currentWorkingDay,
        totalWorkingDays,
        isOverBudget,
        usedRequests,
        monthlyLimit,
    };
}
//# sourceMappingURL=quota-calculator.js.map