import { prisma } from "../../db";

export type DocumentAcknowledgementStatusFilter =
  | "ALL"
  | "ACKNOWLEDGED"
  | "PENDING"
  | "OVERDUE";
export type DocumentAcknowledgementSortKey =
  | "employeeName"
  | "documentName"
  | "assignedAt"
  | "acknowledgedAt"
  | "status";
export type DocumentAcknowledgementSortDirection = "asc" | "desc";

export type DocumentAcknowledgementFilters = {
  status: DocumentAcknowledgementStatusFilter;
  asOfDate: string;
  documentId: string;
  category: string;
  employee: string;
  assignedById: string;
  assignedDateFrom: string;
  assignedDateTo: string;
  acknowledgedDateFrom: string;
  acknowledgedDateTo: string;
  sort: DocumentAcknowledgementSortKey;
  direction: DocumentAcknowledgementSortDirection;
  page: number;
  pageSize: number;
};

export type DocumentAcknowledgementRow = {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  documentId: string;
  documentName: string;
  documentVersion: string;
  documentCategory: string | null;
  assignedAt: string;
  dueDate: string | null;
  acknowledgedAt: string | null;
  status: "ACKNOWLEDGED" | "PENDING" | "OVERDUE";
  assignedById: string;
  assignedByName: string;
};

export type DocumentAcknowledgementSummary = {
  totalAssignments: number;
  acknowledged: number;
  pending: number;
  overdue: number;
};

export type DocumentAcknowledgementFilterOptions = {
  documents: Array<{ id: string; title: string }>;
  categories: string[];
  employees: Array<{ id: string; name: string }>;
  assignedBy: Array<{ id: string; name: string }>;
};

export type DocumentAcknowledgementReportResult = {
  summary: DocumentAcknowledgementSummary;
  filters: DocumentAcknowledgementFilters;
  filterOptions: DocumentAcknowledgementFilterOptions;
  rows: DocumentAcknowledgementRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
};

type DocumentAcknowledgementBaseData = {
  allRows: DocumentAcknowledgementRow[];
  filterOptions: DocumentAcknowledgementFilterOptions;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(
  value: string | undefined
): DocumentAcknowledgementStatusFilter {
  return value === "ACKNOWLEDGED" ||
    value === "PENDING" ||
    value === "OVERDUE" ||
    value === "ALL"
    ? value
    : "ALL";
}

function normalizeSortKey(
  value: string | undefined
): DocumentAcknowledgementSortKey {
  return value === "documentName" ||
    value === "assignedAt" ||
    value === "acknowledgedAt" ||
    value === "status"
    ? value
    : "employeeName";
}

function normalizeSortDirection(
  value: string | undefined
): DocumentAcknowledgementSortDirection {
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

function getAcknowledgementStatus(input: {
  dueDate: Date | null;
  acknowledgedAt: Date | null;
  now: Date;
}): DocumentAcknowledgementRow["status"] {
  if (input.acknowledgedAt) {
    return "ACKNOWLEDGED";
  }

  if (input.dueDate && input.dueDate.getTime() < input.now.getTime()) {
    return "OVERDUE";
  }

  return "PENDING";
}

export function getDocumentAcknowledgementFilters(input: {
  status?: string;
  asOfDate?: string;
  document?: string;
  category?: string;
  employee?: string;
  assignedBy?: string;
  assignedDateFrom?: string;
  assignedDateTo?: string;
  acknowledgedDateFrom?: string;
  acknowledgedDateTo?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): DocumentAcknowledgementFilters {
  return {
    status: normalizeStatusFilter(input.status),
    asOfDate: parseAsOfDate(input.asOfDate).toISOString().split("T")[0],
    documentId: normalizeString(input.document),
    category: normalizeString(input.category),
    employee: normalizeString(input.employee),
    assignedById: normalizeString(input.assignedBy),
    assignedDateFrom: normalizeString(input.assignedDateFrom),
    assignedDateTo: normalizeString(input.assignedDateTo),
    acknowledgedDateFrom: normalizeString(input.acknowledgedDateFrom),
    acknowledgedDateTo: normalizeString(input.acknowledgedDateTo),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function sortRows(
  rows: DocumentAcknowledgementRow[],
  sort: DocumentAcknowledgementSortKey,
  direction: DocumentAcknowledgementSortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const employeeNameCompare = left.employeeName.localeCompare(right.employeeName);

    const compareValue = (() => {
      switch (sort) {
        case "documentName":
          return left.documentName.localeCompare(right.documentName) || employeeNameCompare;
        case "assignedAt":
          return (
            new Date(left.assignedAt).getTime() - new Date(right.assignedAt).getTime() ||
            employeeNameCompare
          );
        case "acknowledgedAt":
          return (
            new Date(left.acknowledgedAt ?? 0).getTime() -
              new Date(right.acknowledgedAt ?? 0).getTime() || employeeNameCompare
          );
        case "status":
          return left.status.localeCompare(right.status) || employeeNameCompare;
        case "employeeName":
        default:
          return employeeNameCompare;
      }
    })();

    return compareValue * multiplier;
  });
}

async function getDocumentAcknowledgementBaseData(
  asOfDate: Date
): Promise<DocumentAcknowledgementBaseData> {
  const assignments = await prisma.employeeDocumentAssignment.findMany({
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      assignableDocument: {
        select: {
          id: true,
          title: true,
          category: true,
        },
      },
      assignableDocumentVersion: {
        select: {
          id: true,
          versionLabel: true,
        },
      },
      assignedByEmployee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
  });

  const asOfEnd = endOfDay(asOfDate);

  const allRows: DocumentAcknowledgementRow[] = assignments
    .filter((assignment) => assignment.assignedAt.getTime() <= asOfEnd.getTime())
    .map((assignment) => ({
    assignmentId: assignment.id,
    employeeId: assignment.employeeId,
    employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
    employeeIdentifier: assignment.employeeId,
    documentId: assignment.assignableDocumentId,
    documentName: assignment.assignableDocument.title,
    documentVersion: assignment.assignableDocumentVersion.versionLabel,
    documentCategory: assignment.assignableDocument.category ?? null,
    assignedAt: assignment.assignedAt.toISOString(),
    dueDate: assignment.dueDate?.toISOString() ?? null,
    acknowledgedAt:
      assignment.acknowledgedAt &&
      assignment.acknowledgedAt.getTime() <= asOfEnd.getTime()
        ? assignment.acknowledgedAt.toISOString()
        : null,
    status: getAcknowledgementStatus({
      dueDate: assignment.dueDate,
      acknowledgedAt:
        assignment.acknowledgedAt &&
        assignment.acknowledgedAt.getTime() <= asOfEnd.getTime()
          ? assignment.acknowledgedAt
          : null,
      now: asOfEnd,
    }),
    assignedById: assignment.assignedByEmployeeId,
    assignedByName: `${assignment.assignedByEmployee.firstName} ${assignment.assignedByEmployee.lastName}`.trim(),
  }));

  return {
    allRows,
    filterOptions: {
      documents: Array.from(
        new Map(
          allRows.map((row) => [
            row.documentId,
            {
              id: row.documentId,
              title: row.documentName,
            },
          ])
        ).values()
      ).sort((left, right) => left.title.localeCompare(right.title)),
      categories: Array.from(
        new Set(
          allRows
            .map((row) => row.documentCategory)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right)),
      employees: Array.from(
        new Map(
          allRows.map((row) => [
            row.employeeId,
            {
              id: row.employeeId,
              name: row.employeeName,
            },
          ])
        ).values()
      ).sort((left, right) => left.name.localeCompare(right.name)),
      assignedBy: Array.from(
        new Map(
          allRows.map((row) => [
            row.assignedById,
            {
              id: row.assignedById,
              name: row.assignedByName,
            },
          ])
        ).values()
      ).sort((left, right) => left.name.localeCompare(right.name)),
    },
  };
}

function buildDocumentAcknowledgementReportResult(
  allRows: DocumentAcknowledgementRow[],
  filterOptions: DocumentAcknowledgementFilterOptions,
  filters: DocumentAcknowledgementFilters
): DocumentAcknowledgementReportResult {
  const employeeSearch = filters.employee.toLowerCase();
  const assignedDateFrom = parseDateOrNull(filters.assignedDateFrom);
  const assignedDateTo = parseDateOrNull(filters.assignedDateTo);
  const acknowledgedDateFrom = parseDateOrNull(filters.acknowledgedDateFrom);
  const acknowledgedDateTo = parseDateOrNull(filters.acknowledgedDateTo);

  const filteredRows = allRows.filter((row) => {
    const matchesStatus =
      filters.status === "ALL" || row.status === filters.status;

    const matchesDocument =
      filters.documentId === "" || row.documentId === filters.documentId;

    const matchesCategory =
      filters.category === "" || row.documentCategory === filters.category;

    const matchesEmployee =
      employeeSearch === "" ||
      row.employeeName.toLowerCase().includes(employeeSearch) ||
      row.employeeIdentifier.toLowerCase().includes(employeeSearch);

    const matchesAssignedBy =
      filters.assignedById === "" || row.assignedById === filters.assignedById;

    const assignedAt = new Date(row.assignedAt);
    const matchesAssignedDateFrom =
      assignedDateFrom == null || assignedAt.getTime() >= assignedDateFrom.getTime();
    const matchesAssignedDateTo =
      assignedDateTo == null || assignedAt.getTime() <= endOfDay(assignedDateTo).getTime();

    const acknowledgedAt = row.acknowledgedAt ? new Date(row.acknowledgedAt) : null;
    const matchesAcknowledgedDateFrom =
      acknowledgedDateFrom == null ||
      (acknowledgedAt != null &&
        acknowledgedAt.getTime() >= acknowledgedDateFrom.getTime());
    const matchesAcknowledgedDateTo =
      acknowledgedDateTo == null ||
      (acknowledgedAt != null &&
        acknowledgedAt.getTime() <= endOfDay(acknowledgedDateTo).getTime());

    return (
      matchesStatus &&
      matchesDocument &&
      matchesCategory &&
      matchesEmployee &&
      matchesAssignedBy &&
      matchesAssignedDateFrom &&
      matchesAssignedDateTo &&
      matchesAcknowledgedDateFrom &&
      matchesAcknowledgedDateTo
    );
  });

  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    summary: {
      totalAssignments: filteredRows.length,
      acknowledged: filteredRows.filter((row) => row.status === "ACKNOWLEDGED").length,
      pending: filteredRows.filter((row) => row.status === "PENDING").length,
      overdue: filteredRows.filter((row) => row.status === "OVERDUE").length,
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
  };
}

export async function getDocumentAcknowledgementReport(
  filters: DocumentAcknowledgementFilters
): Promise<DocumentAcknowledgementReportResult> {
  const { allRows, filterOptions } = await getDocumentAcknowledgementBaseData(
    parseAsOfDate(filters.asOfDate)
  );

  return buildDocumentAcknowledgementReportResult(allRows, filterOptions, filters);
}

export async function getDocumentAcknowledgementExportRows(
  filters: DocumentAcknowledgementFilters
) {
  const report = await getDocumentAcknowledgementReport({
    ...filters,
    page: 1,
    pageSize: 10000,
  });

  return report.rows;
}
