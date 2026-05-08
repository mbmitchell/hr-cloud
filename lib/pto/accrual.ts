export type AccrualMode =
  | "STANDARD_TENURE"
  | "ADVANCED_TIER"
  | "MANUAL_ONLY";

export type AccrualTier =
  | "YEARS_1_TO_5"
  | "YEARS_6_TO_10"
  | "YEARS_11_PLUS";

type EmployeeAccrualInput = {
  hireDate: Date;
  accrualMode?: AccrualMode | null;
  monthlyAccrualOverride?: number | null;
  accrualOverrideReason?: string | null;
  advancedAccrualTier?: AccrualTier | null;
  advancedAccrualEffectiveDate?: Date | null;
  advancedAccrualReason?: string | null;
};

type PolicyInput = {
  accrualRate0To5: number;
  accrualRate6To10: number;
  accrualRateOver10: number;
};

export type AccrualBreakdownRow = {
  monthlyRate: number;
  accrualCount: number;
};

export type AccrualSummary = {
  mode: AccrualMode;
  source: "STANDARD_TENURE" | "ADVANCED_TIER" | "MANUAL_ONLY";
  currentMonthlyRate: number;
  tenureTier: AccrualTier;
  activeTier: AccrualTier | null;
  advancedTier: AccrualTier | null;
  advancedEffectiveDate: string | null;
  manualOverrideRate: number | null;
  reason: string | null;
  nextTier: {
    tier: AccrualTier;
    monthlyRate: number;
    effectiveDate: string;
  } | null;
};

function fullYearsBetween(start: Date, end: Date): number {
  let years = end.getFullYear() - start.getFullYear();

  if (
    end.getMonth() < start.getMonth() ||
    (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())
  ) {
    years -= 1;
  }

  return Math.max(0, years);
}

function addYears(date: Date, years: number) {
  const value = new Date(date);
  value.setFullYear(value.getFullYear() + years);
  return value;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function firstOfMonthOnOrAfter(date: Date) {
  if (date.getDate() === 1) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function firstAccrualDateAfter(date: Date) {
  const start = startOfDay(date);
  const firstOfCurrentMonth = new Date(start.getFullYear(), start.getMonth(), 1);

  if (firstOfCurrentMonth > start) {
    return firstOfCurrentMonth;
  }

  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

const TIER_RANK: Record<AccrualTier, number> = {
  YEARS_1_TO_5: 0,
  YEARS_6_TO_10: 1,
  YEARS_11_PLUS: 2,
};

function resolveAccrualMode(mode?: AccrualMode | null): AccrualMode {
  return mode ?? "STANDARD_TENURE";
}

export function getTenureAccrualTier(hireDate: Date, asOfDate: Date): AccrualTier {
  const years = fullYearsBetween(new Date(hireDate), asOfDate);

  if (years <= 5) return "YEARS_1_TO_5";
  if (years <= 10) return "YEARS_6_TO_10";
  return "YEARS_11_PLUS";
}

export function getAccrualTierRate(
  tier: AccrualTier,
  policy?: PolicyInput
): number {
  const rate0To5 = policy?.accrualRate0To5 ?? 10;
  const rate6To10 = policy?.accrualRate6To10 ?? 13.33;
  const rateOver10 = policy?.accrualRateOver10 ?? 16.67;

  switch (tier) {
    case "YEARS_1_TO_5":
      return rate0To5;
    case "YEARS_6_TO_10":
      return rate6To10;
    case "YEARS_11_PLUS":
      return rateOver10;
  }
}

function getHigherTier(left: AccrualTier, right: AccrualTier): AccrualTier {
  return TIER_RANK[left] >= TIER_RANK[right] ? left : right;
}

function getEffectiveAdvancedTier(
  input: EmployeeAccrualInput,
  asOfDate: Date
): AccrualTier | null {
  if (resolveAccrualMode(input.accrualMode) !== "ADVANCED_TIER") {
    return null;
  }

  if (!input.advancedAccrualTier || !input.advancedAccrualEffectiveDate) {
    return null;
  }

  return startOfDay(asOfDate) >= startOfDay(input.advancedAccrualEffectiveDate)
    ? input.advancedAccrualTier
    : null;
}

function getActiveTier(input: EmployeeAccrualInput, asOfDate: Date): AccrualTier | null {
  const mode = resolveAccrualMode(input.accrualMode);

  if (mode === "MANUAL_ONLY") {
    return null;
  }

  const tenureTier = getTenureAccrualTier(input.hireDate, asOfDate);
  const effectiveAdvancedTier = getEffectiveAdvancedTier(input, asOfDate);

  if (!effectiveAdvancedTier) {
    return tenureTier;
  }

  return getHigherTier(tenureTier, effectiveAdvancedTier);
}

function getReason(input: EmployeeAccrualInput): string | null {
  const mode = resolveAccrualMode(input.accrualMode);

  if (mode === "ADVANCED_TIER") {
    return input.advancedAccrualReason ?? null;
  }

  if (mode === "MANUAL_ONLY") {
    return input.accrualOverrideReason ?? null;
  }

  return null;
}

function formatDateIso(date: Date) {
  return date.toISOString().split("T")[0];
}

function listAccrualTransitionDates(input: EmployeeAccrualInput): Date[] {
  const dates = [
    firstOfMonthOnOrAfter(addYears(input.hireDate, 6)),
    firstOfMonthOnOrAfter(addYears(input.hireDate, 11)),
  ];

  if (
    resolveAccrualMode(input.accrualMode) === "ADVANCED_TIER" &&
    input.advancedAccrualEffectiveDate
  ) {
    dates.push(firstOfMonthOnOrAfter(input.advancedAccrualEffectiveDate));
  }

  return dates;
}

export function getAccrualSummary(
  input: EmployeeAccrualInput,
  asOfDate: Date,
  policy?: PolicyInput
): AccrualSummary {
  const mode = resolveAccrualMode(input.accrualMode);
  const tenureTier = getTenureAccrualTier(input.hireDate, asOfDate);

  if (mode === "MANUAL_ONLY") {
    return {
      mode,
      source: "MANUAL_ONLY",
      currentMonthlyRate: input.monthlyAccrualOverride ?? 0,
      tenureTier,
      activeTier: null,
      advancedTier: null,
      advancedEffectiveDate: null,
      manualOverrideRate: input.monthlyAccrualOverride ?? null,
      reason: input.accrualOverrideReason ?? null,
      nextTier: null,
    };
  }

  const effectiveAdvancedTier = getEffectiveAdvancedTier(input, asOfDate);
  const activeTier = getActiveTier(input, asOfDate) ?? tenureTier;
  const currentMonthlyRate = getAccrualTierRate(activeTier, policy);
  const source =
    effectiveAdvancedTier && TIER_RANK[effectiveAdvancedTier] > TIER_RANK[tenureTier]
      ? "ADVANCED_TIER"
      : "STANDARD_TENURE";

  const candidateDates = listAccrualTransitionDates(input)
    .filter((candidateDate) => candidateDate > startOfDay(asOfDate))
    .sort((left, right) => left.getTime() - right.getTime());

  let nextTier: AccrualSummary["nextTier"] = null;

  for (const candidateDate of candidateDates) {
    const candidateTier = getActiveTier(input, candidateDate);

    if (candidateTier && TIER_RANK[candidateTier] > TIER_RANK[activeTier]) {
      nextTier = {
        tier: candidateTier,
        monthlyRate: getAccrualTierRate(candidateTier, policy),
        effectiveDate: formatDateIso(candidateDate),
      };
      break;
    }
  }

  return {
    mode,
    source,
    currentMonthlyRate,
    tenureTier,
    activeTier,
    advancedTier: input.advancedAccrualTier ?? null,
    advancedEffectiveDate: input.advancedAccrualEffectiveDate
      ? formatDateIso(input.advancedAccrualEffectiveDate)
      : null,
    manualOverrideRate: input.monthlyAccrualOverride ?? null,
    reason: getReason(input),
    nextTier,
  };
}

export function getMonthlyAccrualRate(
  input: EmployeeAccrualInput,
  asOfDate: Date,
  policy?: PolicyInput
): number {
  const summary = getAccrualSummary(input, asOfDate, policy);
  return summary.currentMonthlyRate;
}

function listAccrualDatesBetween(today: Date, requestStartDate: Date): Date[] {
  const start = startOfDay(today);
  const end = startOfDay(requestStartDate);

  if (end <= start) return [];

  const dates: Date[] = [];
  let cursor = firstAccrualDateAfter(start);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return dates;
}

function buildAccrualBreakdown(dates: Date[], input: EmployeeAccrualInput, policy?: PolicyInput) {
  const breakdown: AccrualBreakdownRow[] = [];

  for (const accrualDate of dates) {
    const monthlyRate = getMonthlyAccrualRate(input, accrualDate, policy);
    const previousRow = breakdown[breakdown.length - 1];

    if (previousRow && previousRow.monthlyRate === monthlyRate) {
      previousRow.accrualCount += 1;
      continue;
    }

    breakdown.push({
      monthlyRate,
      accrualCount: 1,
    });
  }

  return breakdown;
}

export function formatAccrualBreakdownSummary(breakdown: AccrualBreakdownRow[]): string {
  if (breakdown.length === 0) {
    return "No future accruals before the request date.";
  }

  if (breakdown.length === 1) {
    return `${breakdown[0].accrualCount} accrual(s) × ${breakdown[0].monthlyRate.toFixed(
      2
    )} hrs/month`;
  }

  return breakdown
    .map(
      (row) =>
        `${row.accrualCount} accrual(s) × ${row.monthlyRate.toFixed(2)} hrs/month`
    )
    .join(", ");
}

export function projectPtoBalance(params: {
  currentBalance: number;
  hireDate: Date;
  requestStartDate: Date;
  accrualMode?: AccrualMode | null;
  monthlyAccrualOverride?: number | null;
  accrualOverrideReason?: string | null;
  advancedAccrualTier?: AccrualTier | null;
  advancedAccrualEffectiveDate?: Date | null;
  advancedAccrualReason?: string | null;
  today?: Date;
  policy?: PolicyInput;
}) {
  const today = params.today ?? new Date();
  const dates = listAccrualDatesBetween(today, params.requestStartDate);
  const employeeAccrualInput: EmployeeAccrualInput = {
    hireDate: params.hireDate,
    accrualMode: params.accrualMode,
    monthlyAccrualOverride: params.monthlyAccrualOverride,
    accrualOverrideReason: params.accrualOverrideReason,
    advancedAccrualTier: params.advancedAccrualTier,
    advancedAccrualEffectiveDate: params.advancedAccrualEffectiveDate,
    advancedAccrualReason: params.advancedAccrualReason,
  };

  const breakdown = buildAccrualBreakdown(dates, employeeAccrualInput, params.policy);
  const accruedBeforeRequest = Number(
    breakdown
      .reduce((total, row) => total + row.monthlyRate * row.accrualCount, 0)
      .toFixed(2)
  );

  return {
    monthlyRate:
      breakdown[0]?.monthlyRate ??
      getMonthlyAccrualRate(employeeAccrualInput, params.requestStartDate, params.policy),
    accrualCount: dates.length,
    accruedBeforeRequest,
    projectedBalance: Number((params.currentBalance + accruedBeforeRequest).toFixed(2)),
    accrualBreakdown: breakdown,
    accrualSummaryText: formatAccrualBreakdownSummary(breakdown),
  };
}
