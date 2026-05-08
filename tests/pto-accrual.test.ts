import test from "node:test";
import assert from "node:assert/strict";

import {
  formatAccrualBreakdownSummary,
  getAccrualSummary,
  getMonthlyAccrualRate,
  projectPtoBalance,
} from "../lib/pto/accrual";

test("tenure accrual follows standard progression", () => {
  const rateYearFive = getMonthlyAccrualRate(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "STANDARD_TENURE",
    },
    new Date("2027-12-01")
  );

  const rateYearSix = getMonthlyAccrualRate(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "STANDARD_TENURE",
    },
    new Date("2028-01-01")
  );

  const rateYearEleven = getMonthlyAccrualRate(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "STANDARD_TENURE",
    },
    new Date("2033-01-01")
  );

  assert.equal(rateYearFive, 10);
  assert.equal(rateYearSix, 13.33);
  assert.equal(rateYearEleven, 16.67);
});

test("advanced tier raises the active tier without blocking later automatic progression", () => {
  const beforeAdvance = getAccrualSummary(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "ADVANCED_TIER",
      advancedAccrualTier: "YEARS_6_TO_10",
      advancedAccrualEffectiveDate: new Date("2025-02-01"),
    },
    new Date("2025-01-01")
  );

  const afterAdvance = getAccrualSummary(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "ADVANCED_TIER",
      advancedAccrualTier: "YEARS_6_TO_10",
      advancedAccrualEffectiveDate: new Date("2025-02-01"),
    },
    new Date("2025-02-01")
  );

  const afterElevenYears = getAccrualSummary(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "ADVANCED_TIER",
      advancedAccrualTier: "YEARS_6_TO_10",
      advancedAccrualEffectiveDate: new Date("2025-02-01"),
    },
    new Date("2033-01-01")
  );

  assert.equal(beforeAdvance.currentMonthlyRate, 10);
  assert.equal(afterAdvance.currentMonthlyRate, 13.33);
  assert.equal(afterAdvance.activeTier, "YEARS_6_TO_10");
  assert.equal(afterElevenYears.currentMonthlyRate, 16.67);
  assert.equal(afterElevenYears.activeTier, "YEARS_11_PLUS");
});

test("projection uses multiple future rates when a request spans a tier change", () => {
  const projection = projectPtoBalance({
    currentBalance: 80,
    hireDate: new Date("2022-01-01"),
    accrualMode: "ADVANCED_TIER",
    advancedAccrualTier: "YEARS_6_TO_10",
    advancedAccrualEffectiveDate: new Date("2025-02-01"),
    today: new Date("2025-01-15"),
    requestStartDate: new Date("2033-03-01"),
  });

  assert.equal(projection.accrualCount > 0, true);
  assert.equal(projection.accrualBreakdown.length >= 2, true);
  assert.match(
    formatAccrualBreakdownSummary(projection.accrualBreakdown),
    /hrs\/month/
  );
  assert.equal(projection.projectedBalance > 80, true);
});

test("manual-only accrual uses the manual override and has no automatic next tier", () => {
  const summary = getAccrualSummary(
    {
      hireDate: new Date("2022-01-01"),
      accrualMode: "MANUAL_ONLY",
      monthlyAccrualOverride: 12.5,
      accrualOverrideReason: "Legacy agreement",
    },
    new Date("2035-01-01")
  );

  assert.equal(summary.currentMonthlyRate, 12.5);
  assert.equal(summary.source, "MANUAL_ONLY");
  assert.equal(summary.nextTier, null);
  assert.equal(summary.reason, "Legacy agreement");
});
