type LiabilityInput = {
  payType?: string | null;
  hourlyRate?: number | null;
  annualSalary?: number | null;
  fte?: number | null;
};

export function getEffectiveHourlyRate(input: LiabilityInput): number {
  const fte = input.fte ?? 1;

  if (input.payType === "HOURLY") {
    return input.hourlyRate ?? 0;
  }

  if (input.payType === "SALARY") {
    const annualSalary = input.annualSalary ?? 0;
    return annualSalary / (2080 * fte || 2080);
  }

  return 0;
}

export function calculatePtoLiability(params: {
  ptoHours: number;
  payType?: string | null;
  hourlyRate?: number | null;
  annualSalary?: number | null;
  fte?: number | null;
}) {
  const effectiveHourlyRate = getEffectiveHourlyRate({
    payType: params.payType,
    hourlyRate: params.hourlyRate,
    annualSalary: params.annualSalary,
    fte: params.fte,
  });

  const liability = params.ptoHours * effectiveHourlyRate;

  return {
    effectiveHourlyRate,
    liability,
  };
}