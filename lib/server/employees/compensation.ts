import { Prisma, type Employee } from "@prisma/client";

const PAY_TYPES = ["SALARY", "HOURLY"] as const;
const PAYROLL_FREQUENCIES = ["BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"] as const;

type PayType = (typeof PAY_TYPES)[number];
type PayrollFrequency = (typeof PAYROLL_FREQUENCIES)[number];

export type ParsedCompensationProfileInput = {
  payType: PayType;
  hourlyRate: Prisma.Decimal | null;
  annualSalary: Prisma.Decimal | null;
  standardHours: Prisma.Decimal;
  payrollFrequency: PayrollFrequency;
  effectiveDate: Date;
  notes: string | null;
};

export type SerializedCompensationProfile = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  profileId: string | null;
  payType: PayType | null;
  hourlyRate: string | null;
  annualSalary: string | null;
  standardHours: string;
  payrollFrequency: PayrollFrequency;
  effectiveDate: string;
  notes: string | null;
  hasProfile: boolean;
};

export type TotalCompensationSummary = {
  baseCompensationAnnual: string | null;
  employerMonthlyBenefitCost: string;
  employerAnnualBenefitCost: string;
  estimatedTotalAnnualCompensation: string | null;
};

function normalizeOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function parseRequiredString(value: unknown, fieldLabel: string) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return normalized;
}

function parseDecimal(
  value: unknown,
  fieldLabel: string,
  options: { allowZero?: boolean } = {}
) {
  if (value == null || value === "") {
    throw new Error(`${fieldLabel} is required.`);
  }

  const normalized = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldLabel} must be a valid amount with up to two decimals.`);
  }

  const decimal = new Prisma.Decimal(normalized);
  const minimum = options.allowZero ? new Prisma.Decimal(0) : new Prisma.Decimal(0.01);

  if (decimal.lessThan(minimum)) {
    throw new Error(
      `${fieldLabel} must be ${options.allowZero ? "zero or greater" : "greater than zero"}.`
    );
  }

  return decimal;
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : Number(value.toString());
}

function deriveLegacyFte(standardHours: Prisma.Decimal) {
  return Number(
    standardHours.div(40).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toString()
  );
}

export function canActorManageEmployeeCompensation(actor: { roles: string[] }) {
  return actor.roles.includes("SITE_ADMIN") || actor.roles.includes("HR_ADMIN");
}

export function parseCompensationProfileInput(
  body: Record<string, unknown>
): ParsedCompensationProfileInput {
  const payType = parseRequiredString(body.payType, "Pay type") as PayType;
  const payrollFrequency = parseRequiredString(
    body.payrollFrequency,
    "Payroll frequency"
  ) as PayrollFrequency;

  if (!PAY_TYPES.includes(payType)) {
    throw new Error("Pay type is invalid.");
  }

  if (!PAYROLL_FREQUENCIES.includes(payrollFrequency)) {
    throw new Error("Payroll frequency is invalid.");
  }

  const effectiveDateRaw = parseRequiredString(body.effectiveDate, "Effective date");
  const effectiveDate = new Date(effectiveDateRaw);

  if (Number.isNaN(effectiveDate.getTime())) {
    throw new Error("Effective date is invalid.");
  }

  const standardHours = parseDecimal(body.standardHours, "Standard hours");
  const notes = normalizeOptionalString(body.notes);
  const hourlyRate =
    payType === "HOURLY" ? parseDecimal(body.hourlyRate, "Hourly rate", { allowZero: true }) : null;
  const annualSalary =
    payType === "SALARY"
      ? parseDecimal(body.annualSalary, "Annual salary", { allowZero: true })
      : null;

  return {
    payType,
    hourlyRate,
    annualSalary,
    standardHours,
    payrollFrequency,
    effectiveDate,
    notes,
  };
}

export function serializeCompensationProfile(
  employee: Pick<
    Employee,
    "id" | "firstName" | "lastName" | "payType" | "hourlyRate" | "annualSalary" | "fte" | "payrollFrequency" | "hireDate"
  > & {
    compensationProfile?: {
      id: string;
      payType: string;
      annualSalary: Prisma.Decimal | null;
      hourlyRate: Prisma.Decimal | null;
      standardHours: Prisma.Decimal;
      payrollFrequency: PayrollFrequency;
      effectiveDate: Date;
      notes: string | null;
    } | null;
  }
): SerializedCompensationProfile {
  const profile = employee.compensationProfile;
  const fallbackStandardHours =
    employee.fte != null
      ? new Prisma.Decimal(employee.fte).mul(40).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : new Prisma.Decimal(40);

  return {
    id: employee.id,
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    profileId: profile?.id ?? null,
    payType:
      (profile?.payType === "SALARY" || profile?.payType === "HOURLY"
        ? profile.payType
        : employee.payType === "SALARY" || employee.payType === "HOURLY"
          ? employee.payType
          : null),
    hourlyRate:
      profile?.hourlyRate?.toFixed(2) ??
      (employee.hourlyRate != null ? employee.hourlyRate.toFixed(2) : null),
    annualSalary:
      profile?.annualSalary?.toFixed(2) ??
      (employee.annualSalary != null ? employee.annualSalary.toFixed(2) : null),
    standardHours: profile?.standardHours?.toFixed(2) ?? fallbackStandardHours.toFixed(2),
    payrollFrequency: profile?.payrollFrequency ?? employee.payrollFrequency,
    effectiveDate:
      (profile?.effectiveDate ?? employee.hireDate).toISOString().split("T")[0],
    notes: profile?.notes ?? null,
    hasProfile: Boolean(profile),
  };
}

export function serializeCompensationAuditValue(
  profile: {
    payType: string;
    annualSalary: Prisma.Decimal | null;
    hourlyRate: Prisma.Decimal | null;
    standardHours: Prisma.Decimal;
    payrollFrequency: PayrollFrequency;
    effectiveDate: Date;
    notes: string | null;
  }
) {
  return {
    payType: profile.payType,
    annualSalary: profile.annualSalary?.toFixed(2) ?? null,
    hourlyRate: profile.hourlyRate?.toFixed(2) ?? null,
    standardHours: profile.standardHours.toFixed(2),
    payrollFrequency: profile.payrollFrequency,
    effectiveDate: profile.effectiveDate.toISOString().split("T")[0],
    notes: profile.notes,
  };
}

export function buildLegacyCompensationSync(update: {
  payType: PayType;
  annualSalary: Prisma.Decimal | null;
  hourlyRate: Prisma.Decimal | null;
  standardHours: Prisma.Decimal;
  payrollFrequency: PayrollFrequency;
}) {
  return {
    payType: update.payType,
    annualSalary: decimalToNumber(update.annualSalary),
    hourlyRate: decimalToNumber(update.hourlyRate),
    fte: deriveLegacyFte(update.standardHours),
    payrollFrequency: update.payrollFrequency,
  };
}

export function calculateTotalCompensationSummary(input: {
  compensationProfile: SerializedCompensationProfile;
  benefitElections: Array<{
    electionStatus: "ENROLLED" | "WAIVED";
    companyMonthlyCost: Prisma.Decimal;
  }>;
}): TotalCompensationSummary {
  const employerMonthlyBenefitCost = input.benefitElections.reduce(
    (sum, election) =>
      election.electionStatus === "ENROLLED"
        ? sum.add(election.companyMonthlyCost)
        : sum,
    new Prisma.Decimal(0)
  );

  const employerAnnualBenefitCost = employerMonthlyBenefitCost.mul(12);

  let baseCompensationAnnual: Prisma.Decimal | null = null;

  if (
    input.compensationProfile.payType === "SALARY" &&
    input.compensationProfile.annualSalary
  ) {
    baseCompensationAnnual = new Prisma.Decimal(input.compensationProfile.annualSalary);
  }

  if (
    input.compensationProfile.payType === "HOURLY" &&
    input.compensationProfile.hourlyRate
  ) {
    baseCompensationAnnual = new Prisma.Decimal(input.compensationProfile.hourlyRate)
      .mul(input.compensationProfile.standardHours)
      .mul(52)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  const estimatedTotalAnnualCompensation = baseCompensationAnnual
    ? baseCompensationAnnual.add(employerAnnualBenefitCost)
    : null;

  return {
    baseCompensationAnnual: baseCompensationAnnual?.toFixed(2) ?? null,
    employerMonthlyBenefitCost: employerMonthlyBenefitCost.toFixed(2),
    employerAnnualBenefitCost: employerAnnualBenefitCost.toFixed(2),
    estimatedTotalAnnualCompensation:
      estimatedTotalAnnualCompensation?.toFixed(2) ?? null,
  };
}
