import { Prisma, type EmployeeBenefitElection } from "@prisma/client";

type BenefitsActor = {
  id: string;
  roles: string[];
};

const BENEFIT_TYPES = ["MEDICAL", "DENTAL", "VISION", "LIFE", "OTHER"] as const;
const ELECTION_STATUSES = ["ENROLLED", "WAIVED"] as const;

type BenefitType = (typeof BENEFIT_TYPES)[number];
type ElectionStatus = (typeof ELECTION_STATUSES)[number];

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

function parseDecimal(value: unknown, fieldLabel: string) {
  if (value == null || value === "") {
    throw new Error(`${fieldLabel} is required.`);
  }

  const normalized = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldLabel} must be a valid amount with up to two decimals.`);
  }

  return new Prisma.Decimal(normalized);
}

function decimalToCents(value: Prisma.Decimal) {
  return value.mul(100).toNumber();
}

export function canActorViewEmployeeBenefits(actor: BenefitsActor, employeeId: string) {
  return (
    actor.id === employeeId ||
    actor.roles.includes("SITE_ADMIN") ||
    actor.roles.includes("HR_ADMIN")
  );
}

export function canActorManageEmployeeBenefits(actor: BenefitsActor) {
  return actor.roles.includes("SITE_ADMIN") || actor.roles.includes("HR_ADMIN");
}

export type EmployeePayrollFrequency =
  | "BIWEEKLY"
  | "SEMI_MONTHLY"
  | "MONTHLY";

export function parseEmployeeBenefitElectionInput(body: Record<string, unknown>) {
  const benefitType = String(body.benefitType ?? "").trim() as BenefitType;
  const planName = parseRequiredString(body.planName, "Plan name");
  const coverageLevel = normalizeOptionalString(body.coverageLevel);
  const electionStatus = String(body.electionStatus ?? "").trim() as ElectionStatus;
  const effectiveDateRaw = String(body.effectiveDate ?? "").trim();
  const notes = normalizeOptionalString(body.notes);

  if (!BENEFIT_TYPES.includes(benefitType)) {
    throw new Error("Benefit type is invalid.");
  }

  if (!ELECTION_STATUSES.includes(electionStatus)) {
    throw new Error("Election status is invalid.");
  }

  if (!effectiveDateRaw) {
    throw new Error("Effective date is required.");
  }

  const effectiveDate = new Date(effectiveDateRaw);

  if (Number.isNaN(effectiveDate.getTime())) {
    throw new Error("Effective date is invalid.");
  }

  const totalMonthlyCost = parseDecimal(body.totalMonthlyCost, "Total monthly cost");
  const companyMonthlyCost = parseDecimal(
    body.companyMonthlyCost,
    "Company monthly cost"
  );
  const employeeMonthlyCost = parseDecimal(
    body.employeeMonthlyCost,
    "Employee monthly cost"
  );

  if (
    decimalToCents(totalMonthlyCost) !==
    decimalToCents(companyMonthlyCost) + decimalToCents(employeeMonthlyCost)
  ) {
    throw new Error(
      "Total monthly cost must equal company monthly cost plus employee monthly cost."
    );
  }

  return {
    benefitType,
    planName,
    coverageLevel,
    electionStatus,
    effectiveDate,
    totalMonthlyCost,
    companyMonthlyCost,
    employeeMonthlyCost,
    notes,
  };
}

export function serializeEmployeeBenefitElection(
  election: EmployeeBenefitElection
) {
  return {
    id: election.id,
    benefitType: election.benefitType,
    planName: election.planName,
    coverageLevel: election.coverageLevel,
    electionStatus: election.electionStatus,
    effectiveDate: election.effectiveDate.toISOString().split("T")[0],
    totalMonthlyCost: election.totalMonthlyCost.toFixed(2),
    companyMonthlyCost: election.companyMonthlyCost.toFixed(2),
    employeeMonthlyCost: election.employeeMonthlyCost.toFixed(2),
    notes: election.notes,
  };
}

export function calculatePerPaycheckWithholding(
  employeeMonthlyCost: Prisma.Decimal,
  payrollFrequency: EmployeePayrollFrequency
) {
  let result: Prisma.Decimal;

  switch (payrollFrequency) {
    case "BIWEEKLY":
      result = employeeMonthlyCost.mul(12).div(26);
      break;
    case "SEMI_MONTHLY":
      result = employeeMonthlyCost.div(2);
      break;
    case "MONTHLY":
      result = employeeMonthlyCost;
      break;
  }

  return result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}
