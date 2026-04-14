import { prisma } from "../../db";

export type AuditLogOutcomeFilter = "ALL" | "SUCCESS" | "FAILURE" | "OTHER";
export type AuditLogSortKey =
  | "timestamp"
  | "actorName"
  | "action"
  | "entityType"
  | "outcome";
export type AuditLogSortDirection = "asc" | "desc";

export type AuditLogFilters = {
  dateFrom: string;
  dateTo: string;
  actor: string;
  action: string;
  entityType: string;
  outcome: AuditLogOutcomeFilter;
  relatedEmployee: string;
  sort: AuditLogSortKey;
  direction: AuditLogSortDirection;
  page: number;
  pageSize: number;
};

export type AuditLogRow = {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  relatedEmployeeId: string | null;
  relatedEmployeeName: string | null;
  outcome: AuditLogOutcomeFilter;
  summary: string;
};

export type AuditLogSummary = {
  totalAuditEvents: number;
  eventsWithActor: number;
  eventsWithoutActor: number;
  distinctActors: number;
};

export type AuditLogFilterOptions = {
  actions: string[];
  entityTypes: string[];
};

export type AuditLogReportResult = {
  summary: AuditLogSummary;
  filters: AuditLogFilters;
  filterOptions: AuditLogFilterOptions;
  rows: AuditLogRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  authoritativeTimestampField: "createdAt";
};

type AuditLogBaseData = {
  allRows: AuditLogRow[];
  filterOptions: AuditLogFilterOptions;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeOutcomeFilter(value: string | undefined): AuditLogOutcomeFilter {
  return value === "SUCCESS" ||
    value === "FAILURE" ||
    value === "OTHER" ||
    value === "ALL"
    ? value
    : "ALL";
}

function normalizeSortKey(value: string | undefined): AuditLogSortKey {
  return value === "actorName" ||
    value === "action" ||
    value === "entityType" ||
    value === "outcome"
    ? value
    : "timestamp";
}

function normalizeSortDirection(value: string | undefined): AuditLogSortDirection {
  return value === "asc" ? "asc" : "desc";
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseDateOrNull(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function safeParseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getStringValue(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOutcomeFromValue(value: string | null): AuditLogOutcomeFilter | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (
    [
      "success",
      "successful",
      "sent",
      "created",
      "approved",
      "applied",
      "completed",
    ].includes(normalized)
  ) {
    return "SUCCESS";
  }

  if (
    ["failed", "failure", "denied", "error", "rejected"].includes(normalized)
  ) {
    return "FAILURE";
  }

  if (["skipped", "pending", "running", "other", "unknown"].includes(normalized)) {
    return "OTHER";
  }

  return null;
}

function normalizeOutcome(input: {
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}): AuditLogOutcomeFilter {
  const payloadOutcome =
    getOutcomeFromValue(getStringValue(input.newValue, "outcome")) ??
    getOutcomeFromValue(getStringValue(input.newValue, "status")) ??
    getOutcomeFromValue(getStringValue(input.oldValue, "outcome")) ??
    getOutcomeFromValue(getStringValue(input.oldValue, "status"));

  if (payloadOutcome) {
    return payloadOutcome;
  }

  const action = input.action.toUpperCase();

  if (action.includes("FAILED") || action.includes("DENIED")) {
    return "FAILURE";
  }

  if (action.includes("SENT")) {
    return "SUCCESS";
  }

  return "OTHER";
}

function extractRelatedEmployeeId(input: {
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}) {
  const keys = [
    "employeeId",
    "relatedEmployeeId",
    "targetEmployeeId",
    "assignedEmployeeId",
    "recipientEmployeeId",
  ];

  for (const key of keys) {
    const nextValue = getStringValue(input.newValue, key);
    if (nextValue) {
      return nextValue;
    }

    const oldValue = getStringValue(input.oldValue, key);
    if (oldValue) {
      return oldValue;
    }
  }

  if (input.entityType === "Employee" && input.entityId.trim()) {
    return input.entityId;
  }

  return null;
}

function getSummary(input: {
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}) {
  const summaryCandidateKeys = [
    "summary",
    "message",
    "reason",
    "reasonCode",
    "eventType",
  ];

  for (const key of summaryCandidateKeys) {
    const nextValue = getStringValue(input.newValue, key);
    if (nextValue) {
      return nextValue;
    }

    const oldValue = getStringValue(input.oldValue, key);
    if (oldValue) {
      return oldValue;
    }
  }

  const newKeys = input.newValue ? Object.keys(input.newValue) : [];
  if (newKeys.length > 0) {
    return `Updated context: ${newKeys.slice(0, 3).join(", ")}`;
  }

  return `${input.action} on ${input.entityType} ${input.entityId}`;
}

export function getAuditLogFilters(input: {
  dateFrom?: string;
  dateTo?: string;
  actor?: string;
  action?: string;
  entityType?: string;
  outcome?: string;
  relatedEmployee?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): AuditLogFilters {
  return {
    dateFrom: normalizeString(input.dateFrom),
    dateTo: normalizeString(input.dateTo),
    actor: normalizeString(input.actor),
    action: normalizeString(input.action),
    entityType: normalizeString(input.entityType),
    outcome: normalizeOutcomeFilter(input.outcome),
    relatedEmployee: normalizeString(input.relatedEmployee),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function sortRows(
  rows: AuditLogRow[],
  sort: AuditLogSortKey,
  direction: AuditLogSortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const timestampCompare =
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();

    const compareValue = (() => {
      switch (sort) {
        case "actorName":
          return (
            normalizeString(left.actorName).localeCompare(
              normalizeString(right.actorName)
            ) || timestampCompare
          );
        case "action":
          return left.action.localeCompare(right.action) || timestampCompare;
        case "entityType":
          return left.entityType.localeCompare(right.entityType) || timestampCompare;
        case "outcome":
          return left.outcome.localeCompare(right.outcome) || timestampCompare;
        case "timestamp":
        default:
          return timestampCompare;
      }
    })();

    return compareValue * multiplier;
  });
}

async function getAuditLogBaseData(): Promise<AuditLogBaseData> {
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  const relatedEmployeeIds = new Set<string>();
  const actorIds = new Set<string>();
  const parsedRows = logs.map((log) => {
    const oldValue = safeParseJson(log.oldValue);
    const newValue = safeParseJson(log.newValue);
    const relatedEmployeeId = extractRelatedEmployeeId({
      entityType: log.entityType,
      entityId: log.entityId,
      oldValue,
      newValue,
    });

    if (relatedEmployeeId) {
      relatedEmployeeIds.add(relatedEmployeeId);
    }

    if (log.userId && !log.userId.startsWith("system") && !log.userId.startsWith("auth:")) {
      actorIds.add(log.userId);
    }

    return {
      log,
      oldValue,
      newValue,
      relatedEmployeeId,
    };
  });

  const employees = await prisma.employee.findMany({
    where: {
      id: {
        in: Array.from(new Set([...actorIds, ...relatedEmployeeIds])),
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const employeeMap = new Map(
    employees.map((employee) => [
      employee.id,
      `${employee.firstName} ${employee.lastName}`.trim(),
    ])
  );

  const allRows: AuditLogRow[] = parsedRows.map(({ log, oldValue, newValue, relatedEmployeeId }) => ({
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    actorId: log.userId,
    actorName: employeeMap.get(log.userId) ?? null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    relatedEmployeeId,
    relatedEmployeeName: relatedEmployeeId
      ? employeeMap.get(relatedEmployeeId) ?? null
      : null,
    outcome: normalizeOutcome({
      action: log.action,
      oldValue,
      newValue,
    }),
    summary: getSummary({
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValue,
      newValue,
    }),
  }));

  return {
    allRows,
    filterOptions: {
      actions: Array.from(new Set(allRows.map((row) => row.action))).sort((a, b) =>
        a.localeCompare(b)
      ),
      entityTypes: Array.from(new Set(allRows.map((row) => row.entityType))).sort((a, b) =>
        a.localeCompare(b)
      ),
    },
  };
}

function buildAuditLogReportResult(
  allRows: AuditLogRow[],
  filterOptions: AuditLogFilterOptions,
  filters: AuditLogFilters
): AuditLogReportResult {
  const actorSearch = filters.actor.toLowerCase();
  const relatedEmployeeSearch = filters.relatedEmployee.toLowerCase();
  const dateFrom = parseDateOrNull(filters.dateFrom);
  const dateTo = parseDateOrNull(filters.dateTo);

  const filteredRows = allRows.filter((row) => {
    const matchesActor =
      actorSearch === "" ||
      row.actorId.toLowerCase().includes(actorSearch) ||
      normalizeString(row.actorName).toLowerCase().includes(actorSearch);

    const matchesAction =
      filters.action === "" || row.action === filters.action;

    const matchesEntityType =
      filters.entityType === "" || row.entityType === filters.entityType;

    const matchesOutcome =
      filters.outcome === "ALL" || row.outcome === filters.outcome;

    const matchesRelatedEmployee =
      relatedEmployeeSearch === "" ||
      normalizeString(row.relatedEmployeeId)
        .toLowerCase()
        .includes(relatedEmployeeSearch) ||
      normalizeString(row.relatedEmployeeName)
        .toLowerCase()
        .includes(relatedEmployeeSearch);

    const timestamp = new Date(row.timestamp);
    const matchesDateFrom =
      dateFrom == null || timestamp.getTime() >= dateFrom.getTime();
    const matchesDateTo =
      dateTo == null || timestamp.getTime() <= endOfDay(dateTo).getTime();

    return (
      matchesActor &&
      matchesAction &&
      matchesEntityType &&
      matchesOutcome &&
      matchesRelatedEmployee &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  const actorIds = new Set(
    filteredRows
      .filter((row) => row.actorId.trim() !== "")
      .map((row) => row.actorId)
  );

  return {
    summary: {
      totalAuditEvents: filteredRows.length,
      eventsWithActor: filteredRows.filter((row) => row.actorId.trim() !== "").length,
      eventsWithoutActor: filteredRows.filter((row) => row.actorId.trim() === "").length,
      distinctActors: actorIds.size,
    },
    filters: {
      ...filters,
      page,
    },
    filterOptions,
    rows: sortedRows.slice(start, start + filters.pageSize),
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalRows,
      totalPages,
    },
    authoritativeTimestampField: "createdAt",
  };
}

export async function getAuditLogReport(
  filters: AuditLogFilters
): Promise<AuditLogReportResult> {
  const { allRows, filterOptions } = await getAuditLogBaseData();
  return buildAuditLogReportResult(allRows, filterOptions, filters);
}

export async function getAuditLogExportRows(filters: AuditLogFilters) {
  const report = await getAuditLogReport({
    ...filters,
    page: 1,
    pageSize: 10000,
  });

  return report.rows;
}
