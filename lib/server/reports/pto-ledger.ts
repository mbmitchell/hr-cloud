import { prisma } from "../../db";

export type PtoLedgerStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
export type PtoLedgerBalanceStateFilter =
  | "ALL"
  | "NEGATIVE"
  | "ZERO"
  | "POSITIVE";
export type PtoLedgerSortKey =
  | "employeeName"
  | "effectiveDate"
  | "entryType"
  | "hours"
  | "balance";
export type PtoLedgerSortDirection = "asc" | "desc";

export type PtoLedgerFilters = {
  employee: string;
  entryType: string;
  asOfDate: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  status: PtoLedgerStatusFilter;
  balanceState: PtoLedgerBalanceStateFilter;
  sort: PtoLedgerSortKey;
  direction: PtoLedgerSortDirection;
  page: number;
  pageSize: number;
};

export type PtoLedgerRow = {
  ledgerEntryId: string;
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  effectiveDate: string;
  entryType: string;
  entryTypeLabel: string;
  hours: number;
  balanceAfterEntry: number;
  reason: string | null;
  relatedSource: string;
  department: string | null;
  employeeStatus: string;
  currentBalance: number;
};

export type PtoLedgerSummary = {
  totalLedgerEntries: number;
  totalActiveEmployeesInScope: number;
  currentAggregatePtoBalance: number;
  negativeBalanceEmployees: number;
};

export type PtoLedgerFilterOptions = {
  entryTypes: string[];
  departments: string[];
};

export type PtoLedgerReportResult = {
  summary: PtoLedgerSummary;
  filters: PtoLedgerFilters;
  filterOptions: PtoLedgerFilterOptions;
  rows: PtoLedgerRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  authoritativeDateField: "effectiveDate";
};

type PtoLedgerBaseData = {
  allRows: PtoLedgerRow[];
  filterOptions: PtoLedgerFilterOptions;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(value: string | undefined): PtoLedgerStatusFilter {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ALL"
    ? value
    : "ALL";
}

function normalizeBalanceStateFilter(
  value: string | undefined
): PtoLedgerBalanceStateFilter {
  return value === "NEGATIVE" ||
    value === "ZERO" ||
    value === "POSITIVE" ||
    value === "ALL"
    ? value
    : "ALL";
}

function normalizeSortKey(value: string | undefined): PtoLedgerSortKey {
  return value === "effectiveDate" ||
    value === "entryType" ||
    value === "hours" ||
    value === "balance"
    ? value
    : "employeeName";
}

function normalizeSortDirection(value: string | undefined): PtoLedgerSortDirection {
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

function getEntryTypeLabel(entryType: string) {
  switch (entryType) {
    case "ACCRUAL":
      return "Accrual";
    case "USAGE":
      return "Usage";
    case "FORFEITURE":
      return "Forfeiture / Rollover";
    case "MANUAL_ADD":
      return "Manual Adjustment";
    case "MANUAL_SUBTRACT":
      return "Manual Adjustment";
    default:
      return entryType;
  }
}

function getRelatedSource(input: {
  sourceRequestId: string | null;
  entryType: string;
}) {
  if (input.sourceRequestId) {
    return "PTO Request";
  }

  switch (input.entryType) {
    case "ACCRUAL":
      return "Monthly Accrual";
    case "FORFEITURE":
      return "Year-End Rollover";
    case "MANUAL_ADD":
    case "MANUAL_SUBTRACT":
      return "Manual Adjustment";
    default:
      return "PTO Ledger";
  }
}

export function getPtoLedgerFilters(input: {
  employee?: string;
  entryType?: string;
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  status?: string;
  balanceState?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): PtoLedgerFilters {
  return {
    employee: normalizeString(input.employee),
    entryType: normalizeString(input.entryType),
    asOfDate: parseAsOfDate(input.asOfDate).toISOString().split("T")[0],
    dateFrom: normalizeString(input.dateFrom),
    dateTo: normalizeString(input.dateTo),
    department: normalizeString(input.department),
    status: normalizeStatusFilter(input.status),
    balanceState: normalizeBalanceStateFilter(input.balanceState),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function sortRows(
  rows: PtoLedgerRow[],
  sort: PtoLedgerSortKey,
  direction: PtoLedgerSortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const employeeNameCompare = left.employeeName.localeCompare(right.employeeName);

    const compareValue = (() => {
      switch (sort) {
        case "effectiveDate":
          return (
            new Date(left.effectiveDate).getTime() -
              new Date(right.effectiveDate).getTime() || employeeNameCompare
          );
        case "entryType":
          return left.entryType.localeCompare(right.entryType) || employeeNameCompare;
        case "hours":
          return left.hours - right.hours || employeeNameCompare;
        case "balance":
          return left.balanceAfterEntry - right.balanceAfterEntry || employeeNameCompare;
        case "employeeName":
        default:
          return employeeNameCompare;
      }
    })();

    return compareValue * multiplier;
  });
}

async function getPtoLedgerBaseData(asOfDate: Date): Promise<PtoLedgerBaseData> {
  const asOfEnd = endOfDay(asOfDate);
  const [employees, ledgerEntries] = await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        status: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.pTOLedger.findMany({
      where: {
        bucket: "PTO",
        effectiveDate: {
          lte: asOfEnd,
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const employeeMap = new Map(
    employees.map((employee) => [employee.id, employee] as const)
  );
  const latestBalanceByEmployeeId = new Map<string, number>();

  for (const entry of ledgerEntries) {
    if (!latestBalanceByEmployeeId.has(entry.employeeId)) {
      latestBalanceByEmployeeId.set(entry.employeeId, entry.balance);
    }
  }

  const allRows: PtoLedgerRow[] = ledgerEntries
    .map((entry) => {
      const employee = employeeMap.get(entry.employeeId);

      if (!employee) {
        return null;
      }

      return {
        ledgerEntryId: entry.id,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeIdentifier: employee.id,
        effectiveDate: entry.effectiveDate.toISOString(),
        entryType: entry.type,
        entryTypeLabel: getEntryTypeLabel(entry.type),
        hours: entry.hours,
        balanceAfterEntry: entry.balance,
        reason: entry.notes ?? null,
        relatedSource: getRelatedSource({
          sourceRequestId: entry.sourceRequestId ?? null,
          entryType: entry.type,
        }),
        department: employee.department ?? null,
        employeeStatus: employee.status,
        currentBalance: latestBalanceByEmployeeId.get(employee.id) ?? 0,
      };
    })
    .filter((row): row is PtoLedgerRow => row != null);

  return {
    allRows,
    filterOptions: {
      entryTypes: Array.from(new Set(allRows.map((row) => row.entryType))).sort((a, b) =>
        a.localeCompare(b)
      ),
      departments: Array.from(
        new Set(
          allRows
            .map((row) => row.department)
            .filter((department): department is string => Boolean(department))
        )
      ).sort((a, b) => a.localeCompare(b)),
    },
  };
}

function matchesBalanceState(
  currentBalance: number,
  filter: PtoLedgerBalanceStateFilter
) {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "NEGATIVE") {
    return currentBalance < 0;
  }

  if (filter === "ZERO") {
    return currentBalance === 0;
  }

  return currentBalance > 0;
}

function buildPtoLedgerReportResult(
  allRows: PtoLedgerRow[],
  filterOptions: PtoLedgerFilterOptions,
  filters: PtoLedgerFilters
): PtoLedgerReportResult {
  const employeeSearch = filters.employee.toLowerCase();
  const dateFrom = parseDateOrNull(filters.dateFrom);
  const dateTo = parseDateOrNull(filters.dateTo);

  const filteredRows = allRows.filter((row) => {
    const matchesEmployee =
      employeeSearch === "" ||
      row.employeeName.toLowerCase().includes(employeeSearch) ||
      row.employeeIdentifier.toLowerCase().includes(employeeSearch);

    const matchesEntryType =
      filters.entryType === "" || row.entryType === filters.entryType;

    const matchesDepartment =
      filters.department === "" || row.department === filters.department;

    const matchesStatus =
      filters.status === "ALL"
        ? true
        : filters.status === "ACTIVE"
          ? row.employeeStatus === "ACTIVE"
          : row.employeeStatus !== "ACTIVE";

    const matchesBalance =
      matchesBalanceState(row.currentBalance, filters.balanceState);

    const effectiveDate = new Date(row.effectiveDate);
    const matchesDateFrom =
      dateFrom == null || effectiveDate.getTime() >= dateFrom.getTime();
    const matchesDateTo =
      dateTo == null || effectiveDate.getTime() <= endOfDay(dateTo).getTime();

    return (
      matchesEmployee &&
      matchesEntryType &&
      matchesDepartment &&
      matchesStatus &&
      matchesBalance &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  const employeeScope = Array.from(
    new Map(filteredRows.map((row) => [row.employeeId, row])).values()
  );
  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    summary: {
      totalLedgerEntries: filteredRows.length,
      totalActiveEmployeesInScope: employeeScope.filter(
        (row) => row.employeeStatus === "ACTIVE"
      ).length,
      currentAggregatePtoBalance: Number(
        employeeScope
          .reduce((sum, row) => sum + row.currentBalance, 0)
          .toFixed(2)
      ),
      negativeBalanceEmployees: employeeScope.filter(
        (row) => row.currentBalance < 0
      ).length,
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
    authoritativeDateField: "effectiveDate",
  };
}

export async function getPtoLedgerReport(
  filters: PtoLedgerFilters
): Promise<PtoLedgerReportResult> {
  const { allRows, filterOptions } = await getPtoLedgerBaseData(
    parseAsOfDate(filters.asOfDate)
  );
  return buildPtoLedgerReportResult(allRows, filterOptions, filters);
}

export async function getPtoLedgerExportRows(filters: PtoLedgerFilters) {
  const report = await getPtoLedgerReport({
    ...filters,
    page: 1,
    pageSize: 10000,
  });

  return report.rows;
}
