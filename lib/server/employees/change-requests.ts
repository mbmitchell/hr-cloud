import { Prisma } from "@prisma/client";

import { buildLegacyCompensationSync, parseCompensationProfileInput } from "./compensation";

const CHANGE_REQUEST_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "APPLIED",
  "CANCELLED",
] as const;

const CHANGE_TYPES = [
  "COMPENSATION",
  "JOB_INFO",
  "MANAGER",
  "STATUS",
  "LOCATION",
  "CLASSIFICATION",
  "OTHER",
] as const;

type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];
type ChangeType = (typeof CHANGE_TYPES)[number];

export type EmployeeChangeValues = {
  title?: string | null;
  department?: string | null;
  managerId?: string | null;
  status?: string;
  employmentClassification?: string | null;
  workLocation?: string | null;
  compensation?: {
    payType: "SALARY" | "HOURLY";
    annualSalary: string | null;
    hourlyRate: string | null;
    standardHours: string;
    payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
    effectiveDate: string;
  };
};

export type SerializedEmployeeChangeRequest = {
  id: string;
  employeeId: string;
  status: ChangeRequestStatus;
  changeType: ChangeType;
  requestedBy: {
    id: string;
    name: string;
  };
  reviewedBy: {
    id: string;
    name: string;
  } | null;
  submittedAt: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  requestedEffectiveDate: string;
  actualEffectiveDate: string | null;
  reason: string | null;
  notes: string | null;
  relatedDocument: {
    id: string;
    originalFileName: string;
    category: string;
  } | null;
  oldValues: EmployeeChangeValues;
  newValues: EmployeeChangeValues;
  summary: string[];
  createdAt: string;
  updatedAt: string;
};

function normalizeOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function parseRequiredString(value: unknown, label: string) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function parseRequestedEffectiveDate(value: unknown) {
  const raw = parseRequiredString(value, "Requested effective date");
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Requested effective date is invalid.");
  }

  return parsed;
}

function parseCompensationValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Compensation change details are invalid.");
  }

  const parsed = parseCompensationProfileInput(value as Record<string, unknown>);

  return {
    payType: parsed.payType,
    annualSalary: parsed.annualSalary?.toFixed(2) ?? null,
    hourlyRate: parsed.hourlyRate?.toFixed(2) ?? null,
    standardHours: parsed.standardHours.toFixed(2),
    payrollFrequency: parsed.payrollFrequency,
    effectiveDate: parsed.effectiveDate.toISOString().split("T")[0],
  };
}

function hasAtLeastOneSupportedChange(values: EmployeeChangeValues) {
  return Object.keys(values).length > 0;
}

export function canActorManageEmployeeChangeRequests(actor: { roles: string[] }) {
  return actor.roles.includes("SITE_ADMIN") || actor.roles.includes("HR_ADMIN");
}

export function canActorViewEmployeeChangeRequests(input: {
  actor: { id: string; roles: string[] };
  employeeId: string;
  status?: ChangeRequestStatus;
}) {
  if (canActorManageEmployeeChangeRequests(input.actor)) {
    return true;
  }

  return input.actor.id === input.employeeId && input.status === "APPLIED";
}

export function parseEmployeeChangeRequestInput(body: Record<string, unknown>) {
  const changeType = parseRequiredString(body.changeType, "Change type") as ChangeType;

  if (!CHANGE_TYPES.includes(changeType)) {
    throw new Error("Change type is invalid.");
  }

  const requestedEffectiveDate = parseRequestedEffectiveDate(
    body.requestedEffectiveDate
  );
  const reason = normalizeOptionalString(body.reason);
  const notes = normalizeOptionalString(body.notes);
  const relatedDocumentId = normalizeOptionalString(body.relatedDocumentId);
  const rawChanges = body.newValues;

  if (!rawChanges || typeof rawChanges !== "object" || Array.isArray(rawChanges)) {
    throw new Error("Change values are required.");
  }

  const changesInput = rawChanges as Record<string, unknown>;
  const parsedChanges: EmployeeChangeValues = {};

  if ("title" in changesInput) {
    parsedChanges.title = normalizeOptionalString(changesInput.title);
  }

  if ("department" in changesInput) {
    parsedChanges.department = normalizeOptionalString(changesInput.department);
  }

  if ("managerId" in changesInput) {
    parsedChanges.managerId = normalizeOptionalString(changesInput.managerId);
  }

  if ("status" in changesInput) {
    parsedChanges.status = parseRequiredString(changesInput.status, "Employment status");
  }

  if ("employmentClassification" in changesInput) {
    parsedChanges.employmentClassification = normalizeOptionalString(
      changesInput.employmentClassification
    );
  }

  if ("workLocation" in changesInput) {
    parsedChanges.workLocation = normalizeOptionalString(changesInput.workLocation);
  }

  if ("compensation" in changesInput) {
    parsedChanges.compensation = parseCompensationValues(changesInput.compensation);
  }

  if (!hasAtLeastOneSupportedChange(parsedChanges)) {
    throw new Error("At least one supported field change is required.");
  }

  return {
    changeType,
    requestedEffectiveDate,
    reason,
    notes,
    relatedDocumentId,
    newValues: parsedChanges,
  };
}

function pickOldValueSnapshot(
  employee: {
    title: string | null;
    department: string | null;
    managerId: string | null;
    status: string;
    employmentClassification: string | null;
    workLocation: string | null;
    payType: string | null;
    annualSalary: number | null;
    hourlyRate: number | null;
    fte: number | null;
    payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
    hireDate: Date;
    compensationProfile?: {
      payType: string;
      annualSalary: Prisma.Decimal | null;
      hourlyRate: Prisma.Decimal | null;
      standardHours: Prisma.Decimal;
      payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
      effectiveDate: Date;
    } | null;
  },
  newValues: EmployeeChangeValues
): EmployeeChangeValues {
  const oldValues: EmployeeChangeValues = {};

  if ("title" in newValues) {
    oldValues.title = employee.title;
  }

  if ("department" in newValues) {
    oldValues.department = employee.department;
  }

  if ("managerId" in newValues) {
    oldValues.managerId = employee.managerId;
  }

  if ("status" in newValues) {
    oldValues.status = employee.status;
  }

  if ("employmentClassification" in newValues) {
    oldValues.employmentClassification = employee.employmentClassification;
  }

  if ("workLocation" in newValues) {
    oldValues.workLocation = employee.workLocation;
  }

  if ("compensation" in newValues) {
    const profile = employee.compensationProfile;
    const fallbackStandardHours =
      employee.fte != null
        ? new Prisma.Decimal(employee.fte).mul(40).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : new Prisma.Decimal(40);

    oldValues.compensation = {
      payType:
        profile?.payType === "HOURLY" ? "HOURLY" : "SALARY",
      annualSalary:
        profile?.annualSalary?.toFixed(2) ??
        (employee.annualSalary != null ? employee.annualSalary.toFixed(2) : null),
      hourlyRate:
        profile?.hourlyRate?.toFixed(2) ??
        (employee.hourlyRate != null ? employee.hourlyRate.toFixed(2) : null),
      standardHours: profile?.standardHours?.toFixed(2) ?? fallbackStandardHours.toFixed(2),
      payrollFrequency: profile?.payrollFrequency ?? employee.payrollFrequency,
      effectiveDate:
        (profile?.effectiveDate ?? employee.hireDate).toISOString().split("T")[0],
    };
  }

  return oldValues;
}

export function buildEmployeeChangeRequestSnapshots(
  employee: {
    title: string | null;
    department: string | null;
    managerId: string | null;
    status: string;
    employmentClassification: string | null;
    workLocation: string | null;
    payType: string | null;
    annualSalary: number | null;
    hourlyRate: number | null;
    fte: number | null;
    payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
    hireDate: Date;
    compensationProfile?: {
      payType: string;
      annualSalary: Prisma.Decimal | null;
      hourlyRate: Prisma.Decimal | null;
      standardHours: Prisma.Decimal;
      payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
      effectiveDate: Date;
    } | null;
  },
  newValues: EmployeeChangeValues
) {
  return {
    oldValues: pickOldValueSnapshot(employee, newValues),
    newValues,
  };
}

export function summarizeEmployeeChangeValues(values: EmployeeChangeValues) {
  const summary: string[] = [];

  if ("title" in values) {
    summary.push("Title");
  }
  if ("department" in values) {
    summary.push("Department");
  }
  if ("managerId" in values) {
    summary.push("Manager");
  }
  if ("status" in values) {
    summary.push("Employment Status");
  }
  if ("employmentClassification" in values) {
    summary.push("Employment Classification");
  }
  if ("workLocation" in values) {
    summary.push("Work Location");
  }
  if ("compensation" in values) {
    summary.push("Compensation");
  }

  return summary;
}

export function serializeEmployeeChangeRequest(change: {
  id: string;
  employeeId: string;
  status: ChangeRequestStatus;
  changeType: ChangeType;
  submittedAt: Date | null;
  approvedAt: Date | null;
  appliedAt: Date | null;
  cancelledAt: Date | null;
  requestedEffectiveDate: Date;
  actualEffectiveDate: Date | null;
  reason: string | null;
  notes: string | null;
  oldValues: Prisma.JsonValue;
  newValues: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  relatedDocument: {
    id: string;
    originalFileName: string;
    category: string;
  } | null;
}): SerializedEmployeeChangeRequest {
  const newValues = change.newValues as EmployeeChangeValues;
  const oldValues = change.oldValues as EmployeeChangeValues;

  return {
    id: change.id,
    employeeId: change.employeeId,
    status: change.status,
    changeType: change.changeType,
    requestedBy: {
      id: change.requestedBy.id,
      name: `${change.requestedBy.firstName} ${change.requestedBy.lastName}`,
    },
    reviewedBy: change.reviewedBy
      ? {
          id: change.reviewedBy.id,
          name: `${change.reviewedBy.firstName} ${change.reviewedBy.lastName}`,
        }
      : null,
    submittedAt: change.submittedAt?.toISOString() ?? null,
    approvedAt: change.approvedAt?.toISOString() ?? null,
    appliedAt: change.appliedAt?.toISOString() ?? null,
    cancelledAt: change.cancelledAt?.toISOString() ?? null,
    requestedEffectiveDate: change.requestedEffectiveDate.toISOString().split("T")[0],
    actualEffectiveDate: change.actualEffectiveDate?.toISOString().split("T")[0] ?? null,
    reason: change.reason,
    notes: change.notes,
    relatedDocument: change.relatedDocument,
    oldValues,
    newValues,
    summary: summarizeEmployeeChangeValues(newValues),
    createdAt: change.createdAt.toISOString(),
    updatedAt: change.updatedAt.toISOString(),
  };
}

export async function applyEmployeeChangeRequestToEmployee(tx: {
  employee: {
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  employeeCompensationProfile: {
    upsert(args: {
      where: { employeeId: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<unknown>;
  };
}, input: {
  employeeId: string;
  newValues: EmployeeChangeValues;
}) {
  const employeeUpdate: Record<string, unknown> = {};

  if ("title" in input.newValues) {
    employeeUpdate.title = input.newValues.title ?? null;
  }

  if ("department" in input.newValues) {
    employeeUpdate.department = input.newValues.department ?? null;
  }

  if ("managerId" in input.newValues) {
    employeeUpdate.managerId = input.newValues.managerId ?? null;
  }

  if ("status" in input.newValues && input.newValues.status) {
    employeeUpdate.status = input.newValues.status;
  }

  if ("employmentClassification" in input.newValues) {
    employeeUpdate.employmentClassification =
      input.newValues.employmentClassification ?? null;
  }

  if ("workLocation" in input.newValues) {
    employeeUpdate.workLocation = input.newValues.workLocation ?? null;
  }

  if (input.newValues.compensation) {
    const compensationInput = parseCompensationProfileInput({
      ...input.newValues.compensation,
    });

    await tx.employeeCompensationProfile.upsert({
      where: { employeeId: input.employeeId },
      update: {
        ...compensationInput,
      },
      create: {
        employeeId: input.employeeId,
        ...compensationInput,
      },
    });

    Object.assign(employeeUpdate, buildLegacyCompensationSync(compensationInput));
  }

  if (Object.keys(employeeUpdate).length > 0) {
    await tx.employee.update({
      where: { id: input.employeeId },
      data: employeeUpdate,
    });
  }
}

export async function applyApprovedEmployeeChangeRequest(tx: {
  employee: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  employeeChangeRequest: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  employeeStatusHistory: {
    create(args: Record<string, unknown>): Promise<unknown>;
  };
  employeeCompensationProfile: {
    upsert(args: {
      where: { employeeId: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<unknown>;
  };
}, input: {
  changeId: string;
  appliedAt?: Date;
  appliedByEmployeeId?: string | null;
}) {
  const appliedAt = input.appliedAt ?? new Date();
  const change = await tx.employeeChangeRequest.findUnique({
    where: { id: input.changeId },
  });

  if (!change) {
    throw new Error("Employee change request not found.");
  }

  if (
    String(change.status) === "APPLIED" ||
    change.appliedAt != null ||
    change.actualEffectiveDate != null
  ) {
    return {
      outcome: "already-applied" as const,
      change,
      employee: null,
    };
  }

  if (String(change.status) === "CANCELLED") {
    throw new Error("Cancelled change requests cannot be applied.");
  }

  if (String(change.status) !== "APPROVED") {
    throw new Error("Only approved change requests can be applied.");
  }

  const employee = await tx.employee.findUnique({
    where: { id: String(change.employeeId) },
    select: {
      id: true,
      status: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const employeeId = String(employee.id);
  const employeeStatus = String(employee.status);

  const newValues = change.newValues as EmployeeChangeValues;
  const nextStatus =
    typeof newValues.status === "string" ? newValues.status : null;
  const statusHistoryActorId =
    input.appliedByEmployeeId ??
    (typeof change.reviewedByEmployeeId === "string"
      ? change.reviewedByEmployeeId
      : null);

  await applyEmployeeChangeRequestToEmployee(tx, {
    employeeId,
    newValues,
  });

  if (nextStatus && nextStatus !== employeeStatus && statusHistoryActorId) {
    await tx.employeeStatusHistory.create({
      data: {
        employeeId,
        previousStatus: employeeStatus,
        newStatus: nextStatus,
        changedByEmployeeId: statusHistoryActorId,
      },
    });
  }

  const updatedChange = await tx.employeeChangeRequest.update({
    where: { id: input.changeId },
    data: {
      status: "APPLIED",
      ...(input.appliedByEmployeeId
        ? { reviewedByEmployeeId: input.appliedByEmployeeId }
        : {}),
      appliedAt,
      actualEffectiveDate: appliedAt,
    },
  });

  return {
    outcome: "applied" as const,
    change: updatedChange,
    employee,
  };
}
