import { prisma } from "../../db";

export type PtoLiabilityStatusFilter =
  | "ALL"
  | "WITH_LIABILITY"
  | "NO_LIABILITY"
  | "NEGATIVE_BALANCE_REVIEW"
  | "REVIEW_REQUIRED";
export type PtoLiabilityEmployeeStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
export type PtoLiabilitySortKey =
  | "employeeName"
  | "department"
  | "status"
  | "workLocation"
  | "payrollFrequency"
  | "liability";
export type PtoLiabilitySortDirection = "asc" | "desc";

export type PtoLiabilityFilters = {
  employee: string;
  department: string;
  status: PtoLiabilityEmployeeStatusFilter;
  payrollFrequency: string;
  workLocation: string;
  liabilityStatus: PtoLiabilityStatusFilter;
  sort: PtoLiabilitySortKey;
  direction: PtoLiabilitySortDirection;
  page: number;
  pageSize: number;
};

export type PtoLiabilityRow = {
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  department: string | null;
  employeeStatus: string;
  jobTitle: string | null;
  workLocation: string | null;
  payrollFrequency: string;
  estimatedPtoLiability: number;
  liabilityStatus: Exclude<PtoLiabilityStatusFilter, "ALL">;
  liabilityStatusLabel: string;
  snapshotDate: string;
  currentPtoHours: number;
  hasCompleteCompensation: boolean;
};

export type PtoLiabilitySummary = {
  totalEmployeesInScope: number;
  employeesWithLiability: number;
  negativeBalanceReview: number;
  totalPtoLiability: number;
};

export type PtoLiabilityFilterOptions = {
  departments: string[];
  payrollFrequencies: string[];
  workLocations: string[];
};

export type PtoLiabilityReportResult = {
  summary: PtoLiabilitySummary;
  filters: PtoLiabilityFilters;
  filterOptions: PtoLiabilityFilterOptions;
  rows: PtoLiabilityRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  snapshotDate: string;
};

type PtoLiabilityBaseData = {
  allRows: PtoLiabilityRow[];
  filterOptions: PtoLiabilityFilterOptions;
  snapshotDate: string;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(
  value: string | undefined
): PtoLiabilityEmployeeStatusFilter {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ALL"
    ? value
    : "ACTIVE";
}

function normalizeLiabilityStatusFilter(
  value: string | undefined
): PtoLiabilityStatusFilter {
  return value === "WITH_LIABILITY" ||
    value === "NO_LIABILITY" ||
    value === "NEGATIVE_BALANCE_REVIEW" ||
    value === "REVIEW_REQUIRED" ||
    value === "ALL"
    ? value
    : "ALL";
}

function normalizeSortKey(value: string | undefined): PtoLiabilitySortKey {
  return value === "department" ||
    value === "status" ||
    value === "workLocation" ||
    value === "payrollFrequency" ||
    value === "liability"
    ? value
    : "employeeName";
}

function normalizeSortDirection(
  value: string | undefined
): PtoLiabilitySortDirection {
  return value === "desc" ? "desc" : "asc";
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function toSnapshotDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function getLiabilityStatusLabel(
  status: Exclude<PtoLiabilityStatusFilter, "ALL">
) {
  switch (status) {
    case "WITH_LIABILITY":
      return "With Liability";
    case "NO_LIABILITY":
      return "No Liability";
    case "NEGATIVE_BALANCE_REVIEW":
      return "Negative Balance Review";
    case "REVIEW_REQUIRED":
      return "Review Required";
  }
}

function calculateEstimatedPtoLiability(input: {
  payType: string;
  annualSalary: number | null;
  hourlyRate: number | null;
  currentPtoHours: number;
}) {
  if (input.payType === "SALARY" && input.annualSalary != null) {
    return roundCurrency((input.annualSalary / 2080) * input.currentPtoHours);
  }

  if (input.payType === "HOURLY" && input.hourlyRate != null) {
    return roundCurrency(input.hourlyRate * input.currentPtoHours);
  }

  return 0;
}

function sortRows(
  rows: PtoLiabilityRow[],
  sort: PtoLiabilitySortKey,
  direction: PtoLiabilitySortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const employeeNameCompare = left.employeeName.localeCompare(right.employeeName);

    const compareValue = (() => {
      switch (sort) {
        case "department":
          return (
            normalizeString(left.department).localeCompare(
              normalizeString(right.department)
            ) || employeeNameCompare
          );
        case "status":
          return left.employeeStatus.localeCompare(right.employeeStatus) || employeeNameCompare;
        case "workLocation":
          return (
            normalizeString(left.workLocation).localeCompare(
              normalizeString(right.workLocation)
            ) || employeeNameCompare
          );
        case "payrollFrequency":
          return left.payrollFrequency.localeCompare(right.payrollFrequency) || employeeNameCompare;
        case "liability":
          return left.estimatedPtoLiability - right.estimatedPtoLiability || employeeNameCompare;
        case "employeeName":
        default:
          return employeeNameCompare;
      }
    })();

    return compareValue * multiplier;
  });
}

async function getPtoLiabilityBaseData(
  snapshotDate = new Date()
): Promise<PtoLiabilityBaseData> {
  const [employees, ledgerEntries] = await Promise.all([
    prisma.employee.findMany({
      include: {
        compensationProfile: {
          select: {
            payType: true,
            annualSalary: true,
            hourlyRate: true,
            payrollFrequency: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.pTOLedger.findMany({
      where: {
        bucket: "PTO",
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const latestLedgerByEmployeeId = new Map<string, { balance: number }>();

  for (const ledgerEntry of ledgerEntries) {
    if (!latestLedgerByEmployeeId.has(ledgerEntry.employeeId)) {
      latestLedgerByEmployeeId.set(ledgerEntry.employeeId, {
        balance: ledgerEntry.balance,
      });
    }
  }

  const allRows: PtoLiabilityRow[] = employees.map((employee) => {
    const currentPtoHours = latestLedgerByEmployeeId.get(employee.id)?.balance ?? 0;
    const compensationProfile = employee.compensationProfile;
    const payType = compensationProfile?.payType?.trim() ?? "";
    const annualSalary =
      compensationProfile?.annualSalary != null
        ? Number(compensationProfile.annualSalary)
        : null;
    const hourlyRate =
      compensationProfile?.hourlyRate != null
        ? Number(compensationProfile.hourlyRate)
        : null;
    const hasCompleteCompensation =
      payType === "SALARY"
        ? annualSalary != null
        : payType === "HOURLY"
          ? hourlyRate != null
          : false;

    const liabilityStatus: Exclude<PtoLiabilityStatusFilter, "ALL"> =
      currentPtoHours < 0
        ? "NEGATIVE_BALANCE_REVIEW"
        : !hasCompleteCompensation
          ? "REVIEW_REQUIRED"
          : currentPtoHours > 0
            ? "WITH_LIABILITY"
            : "NO_LIABILITY";

    const estimatedPtoLiability =
      liabilityStatus === "WITH_LIABILITY"
        ? calculateEstimatedPtoLiability({
            payType,
            annualSalary,
            hourlyRate,
            currentPtoHours,
          })
        : 0;

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeIdentifier: employee.id,
      department: employee.department ?? null,
      employeeStatus: employee.status,
      jobTitle: employee.title ?? null,
      workLocation: employee.workLocation ?? null,
      payrollFrequency:
        compensationProfile?.payrollFrequency ?? employee.payrollFrequency,
      estimatedPtoLiability,
      liabilityStatus,
      liabilityStatusLabel: getLiabilityStatusLabel(liabilityStatus),
      snapshotDate: toSnapshotDateString(snapshotDate),
      currentPtoHours,
      hasCompleteCompensation,
    };
  });

  const departments = new Set<string>();
  const payrollFrequencies = new Set<string>();
  const workLocations = new Set<string>();

  for (const row of allRows) {
    if (row.department) {
      departments.add(row.department);
    }
    if (row.payrollFrequency) {
      payrollFrequencies.add(row.payrollFrequency);
    }
    if (row.workLocation) {
      workLocations.add(row.workLocation);
    }
  }

  return {
    allRows,
    filterOptions: {
      departments: Array.from(departments).sort(),
      payrollFrequencies: Array.from(payrollFrequencies).sort(),
      workLocations: Array.from(workLocations).sort(),
    },
    snapshotDate: toSnapshotDateString(snapshotDate),
  };
}

export function getPtoLiabilityFilters(input: {
  employee?: string;
  department?: string;
  status?: string;
  payrollFrequency?: string;
  workLocation?: string;
  liabilityStatus?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): PtoLiabilityFilters {
  return {
    employee: normalizeString(input.employee),
    department: normalizeString(input.department),
    status: normalizeStatusFilter(input.status),
    payrollFrequency: normalizeString(input.payrollFrequency),
    workLocation: normalizeString(input.workLocation),
    liabilityStatus: normalizeLiabilityStatusFilter(input.liabilityStatus),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function applyPtoLiabilityFilters(
  rows: PtoLiabilityRow[],
  filters: PtoLiabilityFilters
) {
  const employeeSearch = filters.employee.toLowerCase();

  return rows.filter((row) => {
    if (
      filters.status !== "ALL" &&
      row.employeeStatus.toUpperCase() !== filters.status
    ) {
      return false;
    }

    if (filters.department && row.department !== filters.department) {
      return false;
    }

    if (
      filters.payrollFrequency &&
      row.payrollFrequency !== filters.payrollFrequency
    ) {
      return false;
    }

    if (filters.workLocation && row.workLocation !== filters.workLocation) {
      return false;
    }

    if (
      filters.liabilityStatus !== "ALL" &&
      row.liabilityStatus !== filters.liabilityStatus
    ) {
      return false;
    }

    if (
      employeeSearch &&
      !row.employeeName.toLowerCase().includes(employeeSearch) &&
      !row.employeeIdentifier.toLowerCase().includes(employeeSearch)
    ) {
      return false;
    }

    return true;
  });
}

export async function getPtoLiabilityReport(
  filters: PtoLiabilityFilters,
  snapshotDate = new Date()
): Promise<PtoLiabilityReportResult> {
  const baseData = await getPtoLiabilityBaseData(snapshotDate);
  const filteredRows = applyPtoLiabilityFilters(baseData.allRows, filters);
  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const rows = sortedRows.slice(start, start + filters.pageSize);

  return {
    summary: {
      totalEmployeesInScope: filteredRows.length,
      employeesWithLiability: filteredRows.filter(
        (row) => row.estimatedPtoLiability > 0
      ).length,
      negativeBalanceReview: filteredRows.filter(
        (row) => row.liabilityStatus === "NEGATIVE_BALANCE_REVIEW"
      ).length,
      totalPtoLiability: roundCurrency(
        filteredRows.reduce((sum, row) => sum + row.estimatedPtoLiability, 0)
      ),
    },
    filters: {
      ...filters,
      page,
    },
    filterOptions: baseData.filterOptions,
    rows,
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalRows,
      totalPages,
    },
    snapshotDate: baseData.snapshotDate,
  };
}

export async function getPtoLiabilityExportRows(
  filters: PtoLiabilityFilters,
  snapshotDate = new Date()
) {
  const report = await getPtoLiabilityReport(
    {
      ...filters,
      page: 1,
      pageSize: 10000,
    },
    snapshotDate
  );

  return report.rows;
}
