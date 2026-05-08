import { prisma } from "../../db";

export type ReportingStructureStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
export type ReportingStructureManagerFilter =
  | "ALL"
  | "WITH_MANAGER"
  | "MISSING_MANAGER";
export type ReportingStructureSortKey =
  | "employeeName"
  | "department"
  | "managerName"
  | "status"
  | "hireDate";
export type ReportingStructureSortDirection = "asc" | "desc";

export type ReportingStructureFilters = {
  status: ReportingStructureStatusFilter;
  department: string;
  managerId: string;
  search: string;
  show: ReportingStructureManagerFilter;
  sort: ReportingStructureSortKey;
  direction: ReportingStructureSortDirection;
  page: number;
  pageSize: number;
};

export type ReportingStructureRow = {
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  jobTitle: string | null;
  department: string | null;
  managerId: string | null;
  managerName: string | null;
  status: string;
  hireDate: string;
  role: string;
  workLocation: string | null;
  employmentClassification: string | null;
  hasManagerAssigned: boolean;
  isActive: boolean;
  shouldFlagMissingManager: boolean;
  directReportCount: number;
};

export type ReportingStructureSummary = {
  totalEmployees: number;
  activeEmployees: number;
  managers: number;
  employeesMissingManager: number;
};

export type ReportingStructureManagerOption = {
  id: string;
  name: string;
};

export type ReportingStructureFilterOptions = {
  departments: string[];
  managers: ReportingStructureManagerOption[];
};

export type ReportingStructureReportResult = {
  summary: ReportingStructureSummary;
  filters: ReportingStructureFilters;
  filterOptions: ReportingStructureFilterOptions;
  rows: ReportingStructureRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
};

type ReportingStructureBaseData = {
  allRows: ReportingStructureRow[];
  filterOptions: ReportingStructureFilterOptions;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(value: string | undefined): ReportingStructureStatusFilter {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ALL"
    ? value
    : "ACTIVE";
}

function normalizeShowFilter(value: string | undefined): ReportingStructureManagerFilter {
  return value === "ALL" || value === "WITH_MANAGER" || value === "MISSING_MANAGER"
    ? value
    : "ALL";
}

function normalizeSortKey(value: string | undefined): ReportingStructureSortKey {
  return value === "department" ||
    value === "managerName" ||
    value === "status" ||
    value === "hireDate"
    ? value
    : "employeeName";
}

function normalizeSortDirection(
  value: string | undefined
): ReportingStructureSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getReportingStructureFilters(input: {
  status?: string;
  department?: string;
  manager?: string;
  search?: string;
  show?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): ReportingStructureFilters {
  return {
    status: normalizeStatusFilter(input.status),
    department: normalizeString(input.department),
    managerId: normalizeString(input.manager),
    search: normalizeString(input.search),
    show: normalizeShowFilter(input.show),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function getRoleDisplay(roleAssignments: Array<{ role: { code: string } }>) {
  const roleCodes = Array.from(
    new Set(
      roleAssignments
        .map((assignment) => assignment.role.code)
        .filter((roleCode) => roleCode.trim() !== "")
    )
  ).sort();

  return roleCodes.length > 0 ? roleCodes.join(", ") : "-";
}

function shouldFlagMissingManager(input: {
  status: string;
  managerId: string | null;
  roleCodes: string[];
}) {
  if (input.status !== "ACTIVE" || input.managerId) {
    return false;
  }

  return !input.roleCodes.some((roleCode) =>
    ["HR_ADMIN", "SITE_ADMIN"].includes(roleCode)
  );
}

function sortRows(
  rows: ReportingStructureRow[],
  sort: ReportingStructureSortKey,
  direction: ReportingStructureSortDirection
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
        case "managerName":
          return (
            normalizeString(left.managerName).localeCompare(
              normalizeString(right.managerName)
            ) || employeeNameCompare
          );
        case "status":
          return left.status.localeCompare(right.status) || employeeNameCompare;
        case "hireDate":
          return (
            new Date(left.hireDate).getTime() - new Date(right.hireDate).getTime() ||
            employeeNameCompare
          );
        case "employeeName":
        default:
          return employeeNameCompare;
      }
    })();

    return compareValue * multiplier;
  });
}

export async function getReportingStructureReport(
  filters: ReportingStructureFilters
): Promise<ReportingStructureReportResult> {
  const { allRows, filterOptions } = await getReportingStructureBaseData();
  return buildReportingStructureReportResult(allRows, filterOptions, filters);
}

async function getReportingStructureBaseData(): Promise<ReportingStructureBaseData> {
  const employees = await prisma.employee.findMany({
    include: {
      manager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      roleAssignments: {
        where: {
          isActive: true,
        },
        include: {
          role: {
            select: {
              code: true,
            },
          },
        },
      },
      _count: {
        select: {
          directReports: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const allRows: ReportingStructureRow[] = employees.map((employee) => {
    const roleCodes = employee.roleAssignments.map((assignment) => assignment.role.code);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeIdentifier: employee.id,
      jobTitle: employee.title ?? null,
      department: employee.department ?? null,
      managerId: employee.manager?.id ?? null,
      managerName: employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim()
        : null,
      status: employee.status,
      hireDate: employee.hireDate.toISOString(),
      role: getRoleDisplay(employee.roleAssignments),
      workLocation: employee.workLocation ?? null,
      employmentClassification: employee.employmentClassification ?? null,
      hasManagerAssigned: Boolean(employee.managerId),
      isActive: employee.status === "ACTIVE",
      shouldFlagMissingManager: shouldFlagMissingManager({
        status: employee.status,
        managerId: employee.managerId,
        roleCodes,
      }),
      directReportCount: employee._count.directReports,
    };
  });

  const filterOptions: ReportingStructureFilterOptions = {
    departments: Array.from(
      new Set(
        allRows
          .map((row) => row.department)
          .filter((department): department is string => Boolean(department))
      )
    ).sort((left, right) => left.localeCompare(right)),
    managers: Array.from(
      new Map(
        allRows
          .filter((row) => row.directReportCount > 0)
          .map((row) => [
            row.employeeId,
            {
              id: row.employeeId,
              name: row.employeeName,
            },
          ])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name)),
  };

  return {
    allRows,
    filterOptions,
  };
}

function buildReportingStructureReportResult(
  allRows: ReportingStructureRow[],
  filterOptions: ReportingStructureFilterOptions,
  filters: ReportingStructureFilters
): ReportingStructureReportResult {
  const searchValue = filters.search.toLowerCase();

  const filteredRows = allRows.filter((row) => {
    const matchesStatus =
      filters.status === "ALL"
        ? true
        : filters.status === "ACTIVE"
          ? row.isActive
          : !row.isActive;

    const matchesDepartment =
      filters.department === "" || row.department === filters.department;

    const matchesManager =
      filters.managerId === "" || row.managerId === filters.managerId;

    const matchesSearch =
      searchValue === "" ||
      row.employeeName.toLowerCase().includes(searchValue) ||
      row.employeeIdentifier.toLowerCase().includes(searchValue);

    const matchesShow =
      filters.show === "ALL"
        ? true
        : filters.show === "WITH_MANAGER"
          ? row.hasManagerAssigned
          : row.shouldFlagMissingManager;

    return (
      matchesStatus &&
      matchesDepartment &&
      matchesManager &&
      matchesSearch &&
      matchesShow
    );
  });

  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const rows = sortedRows.slice(start, start + filters.pageSize);

  return {
    summary: {
      totalEmployees: filteredRows.length,
      activeEmployees: filteredRows.filter((row) => row.isActive).length,
      managers: filteredRows.filter((row) => row.directReportCount > 0).length,
      employeesMissingManager: filteredRows.filter(
        (row) => row.shouldFlagMissingManager
      ).length,
    },
    filters: {
      ...filters,
      page,
    },
    filterOptions,
    rows,
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalRows,
      totalPages,
    },
  };
}

export async function getReportingStructureExportRows(
  filters: ReportingStructureFilters
) {
  const { allRows, filterOptions } = await getReportingStructureBaseData();
  const report = buildReportingStructureReportResult(allRows, filterOptions, {
    ...filters,
    page: 1,
    pageSize: Math.max(allRows.length, 1),
  });

  return report.rows;
}
