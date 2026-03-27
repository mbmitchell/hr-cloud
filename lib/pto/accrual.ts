type EmployeeAccrualInput = {
  hireDate: Date;
  monthlyAccrualOverride?: number | null;
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

export function getMonthlyAccrualRate(
  input: EmployeeAccrualInput,
  asOfDate: Date,
  policy?: {
    accrualRate0To5: number;
    accrualRate6To10: number;
    accrualRateOver10: number;
  }
): number {
  if (input.monthlyAccrualOverride != null) {
    return input.monthlyAccrualOverride;
  }

  const years = fullYearsBetween(new Date(input.hireDate), asOfDate);

  const rate0To5 = policy?.accrualRate0To5 ?? 10;
  const rate6To10 = policy?.accrualRate6To10 ?? 13.33;
  const rateOver10 = policy?.accrualRateOver10 ?? 16.67;

  if (years <= 5) return rate0To5;
  if (years <= 10) return rate6To10;
  return rateOver10;
}

export function countAccrualDatesBetween(today: Date, requestStartDate: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(
    requestStartDate.getFullYear(),
    requestStartDate.getMonth(),
    requestStartDate.getDate()
  );

  if (end <= start) return 0;

  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    if (cursor > start && cursor <= end && cursor.getDate() === 1) {
      count += 1;
    }
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  return count;
}

export function projectPtoBalance(params: {
  currentBalance: number;
  hireDate: Date;
  requestStartDate: Date;
  monthlyAccrualOverride?: number | null;
  today?: Date;
  policy?: {
    accrualRate0To5: number;
    accrualRate6To10: number;
    accrualRateOver10: number;
  };
}) {
  const today = params.today ?? new Date();

  const monthlyRate = getMonthlyAccrualRate(
    {
      hireDate: params.hireDate,
      monthlyAccrualOverride: params.monthlyAccrualOverride,
    },
    params.requestStartDate,
    params.policy
  );

  const accrualCount = countAccrualDatesBetween(today, params.requestStartDate);
  const accruedBeforeRequest = accrualCount * monthlyRate;
  const projectedBalance = params.currentBalance + accruedBeforeRequest;

  return {
    monthlyRate,
    accrualCount,
    accruedBeforeRequest,
    projectedBalance,
  };
}