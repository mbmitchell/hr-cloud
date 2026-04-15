import { prisma } from "../../db";
import {
  summarizeEmployeeChangeValues,
  type EmployeeChangeValues,
} from "../employees/change-requests";

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

export type JobChangeHistoryStatusFilter = "ALL" | (typeof CHANGE_REQUEST_STATUSES)[number];
export type JobChangeHistoryChangeTypeFilter = "ALL" | (typeof CHANGE_TYPES)[number];
export type JobChangeHistorySortKey =
  | "employeeName"
  | "changeType"
  | "status"
  | "requestedEffectiveDate"
  | "submittedAt"
  | "appliedAt";
export type JobChangeHistorySortDirection = "asc" | "desc";

export type JobChangeHistoryFilters = {
  status: JobChangeHistoryStatusFilter;
  changeType: JobChangeHistoryChangeTypeFilter;
  asOfDate: string;
  employee: string;
  requestedById: string;
  reviewedById: string;
  dateFrom: string;
  dateTo: string;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  sort: JobChangeHistorySortKey;
  direction: JobChangeHistorySortDirection;
  page: number;
  pageSize: number;
};

export type JobChangeHistoryRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  changeType: (typeof CHANGE_TYPES)[number];
  status: (typeof CHANGE_REQUEST_STATUSES)[number];
  requestedById: string;
  requestedByName: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  requestedEffectiveDate: string;
  actualEffectiveDate: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  changeSummary: string;
  relatedDocumentLabel: string;
  relatedDocumentLinked: boolean;
};

export type JobChangeHistorySummary = {
  totalChangeRequests: number;
  pendingChangeRequests: number;
  approvedNotYetApplied: number;
  appliedChangeRequests: number;
};

export type JobChangeHistoryFilterOptions = {
  changeTypes: Array<(typeof CHANGE_TYPES)[number]>;
  employees: Array<{ id: string; name: string }>;
  requestedBy: Array<{ id: string; name: string }>;
  reviewedBy: Array<{ id: string; name: string }>;
};

export type JobChangeHistoryReportResult = {
  summary: JobChangeHistorySummary;
  filters: JobChangeHistoryFilters;
  filterOptions: JobChangeHistoryFilterOptions;
  rows: JobChangeHistoryRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  dateFilterBasis: "createdAt";
};

type JobChangeHistoryBaseData = {
  allRows: JobChangeHistoryRow[];
  filterOptions: JobChangeHistoryFilterOptions;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(value: string | undefined): JobChangeHistoryStatusFilter {
  return value && (["ALL", ...CHANGE_REQUEST_STATUSES] as readonly string[]).includes(value)
    ? (value as JobChangeHistoryStatusFilter)
    : "ALL";
}

function normalizeChangeTypeFilter(
  value: string | undefined
): JobChangeHistoryChangeTypeFilter {
  return value && (["ALL", ...CHANGE_TYPES] as readonly string[]).includes(value)
    ? (value as JobChangeHistoryChangeTypeFilter)
    : "ALL";
}

function normalizeSortKey(value: string | undefined): JobChangeHistorySortKey {
  return value === "changeType" ||
    value === "status" ||
    value === "requestedEffectiveDate" ||
    value === "submittedAt" ||
    value === "appliedAt"
    ? value
    : "employeeName";
}

function normalizeSortDirection(
  value: string | undefined
): JobChangeHistorySortDirection {
  return value === "desc" ? "desc" : "asc";
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

function parseAsOfDate(value: string | null | undefined) {
  const normalized = normalizeString(value);

  if (!normalized) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function getJobChangeHistoryFilters(input: {
  status?: string;
  changeType?: string;
  asOfDate?: string;
  employee?: string;
  requestedBy?: string;
  reviewedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): JobChangeHistoryFilters {
  return {
    status: normalizeStatusFilter(input.status),
    changeType: normalizeChangeTypeFilter(input.changeType),
    asOfDate: parseAsOfDate(input.asOfDate).toISOString().split("T")[0],
    employee: normalizeString(input.employee),
    requestedById: normalizeString(input.requestedBy),
    reviewedById: normalizeString(input.reviewedBy),
    dateFrom: normalizeString(input.dateFrom),
    dateTo: normalizeString(input.dateTo),
    effectiveDateFrom: normalizeString(input.effectiveDateFrom),
    effectiveDateTo: normalizeString(input.effectiveDateTo),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function deriveRowAsOf(
  row: JobChangeHistoryRow,
  asOfEnd: Date
): JobChangeHistoryRow | null {
  const createdAt = new Date(row.createdAt);

  if (createdAt.getTime() > asOfEnd.getTime()) {
    return null;
  }

  const submittedAt =
    row.submittedAt && new Date(row.submittedAt).getTime() <= asOfEnd.getTime()
      ? row.submittedAt
      : null;
  const approvedAt =
    row.approvedAt && new Date(row.approvedAt).getTime() <= asOfEnd.getTime()
      ? row.approvedAt
      : null;
  const appliedAt =
    row.appliedAt && new Date(row.appliedAt).getTime() <= asOfEnd.getTime()
      ? row.appliedAt
      : null;
  const cancelledAt =
    row.cancelledAt && new Date(row.cancelledAt).getTime() <= asOfEnd.getTime()
      ? row.cancelledAt
      : null;

  const status: JobChangeHistoryRow["status"] = cancelledAt
    ? "CANCELLED"
    : appliedAt
      ? "APPLIED"
      : approvedAt
        ? "APPROVED"
        : submittedAt
          ? "PENDING"
          : "DRAFT";

  return {
    ...row,
    status,
    submittedAt,
    approvedAt,
    appliedAt,
    cancelledAt,
    actualEffectiveDate:
      appliedAt && row.actualEffectiveDate ? row.actualEffectiveDate : null,
    reviewedById: approvedAt ? row.reviewedById : null,
    reviewedByName: approvedAt ? row.reviewedByName : null,
  };
}

function sortRows(
  rows: JobChangeHistoryRow[],
  sort: JobChangeHistorySortKey,
  direction: JobChangeHistorySortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const employeeNameCompare = left.employeeName.localeCompare(right.employeeName);
    const compareValue = (() => {
      switch (sort) {
        case "changeType":
          return left.changeType.localeCompare(right.changeType) || employeeNameCompare;
        case "status":
          return left.status.localeCompare(right.status) || employeeNameCompare;
        case "requestedEffectiveDate":
          return (
            new Date(left.requestedEffectiveDate).getTime() -
              new Date(right.requestedEffectiveDate).getTime() || employeeNameCompare
          );
        case "submittedAt":
          return (
            new Date(left.submittedAt ?? left.createdAt).getTime() -
              new Date(right.submittedAt ?? right.createdAt).getTime() || employeeNameCompare
          );
        case "appliedAt":
          return (
            new Date(left.appliedAt ?? 0).getTime() -
              new Date(right.appliedAt ?? 0).getTime() || employeeNameCompare
          );
        case "employeeName":
        default:
          return employeeNameCompare;
      }
    })();

    return compareValue * multiplier;
  });
}

function getChangeSummary(newValues: EmployeeChangeValues) {
  const summaryParts = summarizeEmployeeChangeValues(newValues);
  return summaryParts.length > 0 ? summaryParts.join(", ") : "Structured change";
}

async function getJobChangeHistoryBaseData(): Promise<JobChangeHistoryBaseData> {
  const changes = await prisma.employeeChangeRequest.findMany({
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      relatedDocument: {
        select: {
          id: true,
          originalFileName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const allRows: JobChangeHistoryRow[] = changes.map((change) => {
    const newValues = change.newValues as EmployeeChangeValues;

    return {
      id: change.id,
      employeeId: change.employeeId,
      employeeName: `${change.employee.firstName} ${change.employee.lastName}`.trim(),
      employeeIdentifier: change.employeeId,
      changeType: change.changeType,
      status: change.status,
      requestedById: change.requestedByEmployeeId,
      requestedByName: `${change.requestedBy.firstName} ${change.requestedBy.lastName}`.trim(),
      reviewedById: change.reviewedByEmployeeId ?? null,
      reviewedByName: change.reviewedBy
        ? `${change.reviewedBy.firstName} ${change.reviewedBy.lastName}`.trim()
        : null,
      requestedEffectiveDate: change.requestedEffectiveDate.toISOString().split("T")[0],
      actualEffectiveDate:
        change.actualEffectiveDate?.toISOString().split("T")[0] ?? null,
      submittedAt: change.submittedAt?.toISOString() ?? null,
      approvedAt: change.approvedAt?.toISOString() ?? null,
      appliedAt: change.appliedAt?.toISOString() ?? null,
      cancelledAt: change.cancelledAt?.toISOString() ?? null,
      createdAt: change.createdAt.toISOString(),
      changeSummary: getChangeSummary(newValues),
      relatedDocumentLabel: change.relatedDocument
        ? change.relatedDocument.originalFileName
        : "None",
      relatedDocumentLinked: Boolean(change.relatedDocument),
    };
  });

  const uniqueEmployeeMap = new Map<string, { id: string; name: string }>();
  const uniqueRequestedByMap = new Map<string, { id: string; name: string }>();
  const uniqueReviewedByMap = new Map<string, { id: string; name: string }>();

  for (const row of allRows) {
    uniqueEmployeeMap.set(row.employeeId, {
      id: row.employeeId,
      name: row.employeeName,
    });
    uniqueRequestedByMap.set(row.requestedById, {
      id: row.requestedById,
      name: row.requestedByName,
    });

    if (row.reviewedById && row.reviewedByName) {
      uniqueReviewedByMap.set(row.reviewedById, {
        id: row.reviewedById,
        name: row.reviewedByName,
      });
    }
  }

  return {
    allRows,
    filterOptions: {
      changeTypes: [...CHANGE_TYPES],
      employees: Array.from(uniqueEmployeeMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      requestedBy: Array.from(uniqueRequestedByMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      reviewedBy: Array.from(uniqueReviewedByMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    },
  };
}

function buildJobChangeHistoryReportResult(
  allRows: JobChangeHistoryRow[],
  filterOptions: JobChangeHistoryFilterOptions,
  filters: JobChangeHistoryFilters
): JobChangeHistoryReportResult {
  const asOfEnd = endOfDay(parseAsOfDate(filters.asOfDate));
  const searchValue = filters.employee.toLowerCase();
  const dateFrom = parseDateOrNull(filters.dateFrom);
  const dateTo = parseDateOrNull(filters.dateTo);
  const effectiveDateFrom = parseDateOrNull(filters.effectiveDateFrom);
  const effectiveDateTo = parseDateOrNull(filters.effectiveDateTo);

  const filteredRows = allRows
    .map((row) => deriveRowAsOf(row, asOfEnd))
    .filter((row): row is JobChangeHistoryRow => row != null)
    .filter((row) => {
    const matchesStatus =
      filters.status === "ALL" || row.status === filters.status;
    const matchesChangeType =
      filters.changeType === "ALL" || row.changeType === filters.changeType;
    const matchesEmployee =
      filters.employee === "" ||
      row.employeeId === filters.employee ||
      row.employeeName.toLowerCase().includes(searchValue) ||
      row.employeeIdentifier.toLowerCase().includes(searchValue);
    const matchesRequestedBy =
      filters.requestedById === "" || row.requestedById === filters.requestedById;
    const matchesReviewedBy =
      filters.reviewedById === "" || row.reviewedById === filters.reviewedById;

    const createdAt = new Date(row.createdAt);
    const requestedEffectiveDate = new Date(row.requestedEffectiveDate);

    const matchesDateFrom = !dateFrom || createdAt >= dateFrom;
    const matchesDateTo = !dateTo || createdAt <= endOfDay(dateTo);
    const matchesEffectiveDateFrom =
      !effectiveDateFrom || requestedEffectiveDate >= effectiveDateFrom;
    const matchesEffectiveDateTo =
      !effectiveDateTo || requestedEffectiveDate <= endOfDay(effectiveDateTo);

    return (
      matchesStatus &&
      matchesChangeType &&
      matchesEmployee &&
      matchesRequestedBy &&
      matchesReviewedBy &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesEffectiveDateFrom &&
      matchesEffectiveDateTo
    );
  });

  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    summary: {
      totalChangeRequests: filteredRows.length,
      pendingChangeRequests: filteredRows.filter((row) => row.status === "PENDING")
        .length,
      approvedNotYetApplied: filteredRows.filter(
        (row) => row.status === "APPROVED" && row.appliedAt == null
      ).length,
      appliedChangeRequests: filteredRows.filter((row) => row.status === "APPLIED")
        .length,
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
    dateFilterBasis: "createdAt",
  };
}

export async function getJobChangeHistoryReport(
  filters: JobChangeHistoryFilters
): Promise<JobChangeHistoryReportResult> {
  const { allRows, filterOptions } = await getJobChangeHistoryBaseData();
  return buildJobChangeHistoryReportResult(allRows, filterOptions, filters);
}

export async function getJobChangeHistoryExportRows(
  filters: JobChangeHistoryFilters
) {
  const { allRows, filterOptions } = await getJobChangeHistoryBaseData();
  const report = buildJobChangeHistoryReportResult(allRows, filterOptions, {
    ...filters,
    page: 1,
    pageSize: Math.max(allRows.length, 1),
  });

  return report.rows;
}
