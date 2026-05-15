import { prisma } from "../../db";
import type { TenantContext } from "../tenant-context";

export type EmployeeMasterStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
export type EmployeeMasterSortKey =
  | "employeeName"
  | "status"
  | "department"
  | "managerName"
  | "hireDate";
export type EmployeeMasterSortDirection = "asc" | "desc";

export type EmployeeMasterFilters = {
  status: EmployeeMasterStatusFilter;
  department: string;
  role: string;
  managerId: string;
  search: string;
  employmentClassification: string;
  sort: EmployeeMasterSortKey;
  direction: EmployeeMasterSortDirection;
  page: number;
  pageSize: number;
};

export type EmployeeMasterRow = {
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  status: string;
  jobTitle: string | null;
  department: string | null;
  managerName: string | null;
  managerId: string | null;
  role: string;
  roleCodes: string[];
  hireDate: string;
  workLocation: string | null;
  employmentClassification: string | null;
  workEmail: string;
  payrollFrequency: string;
  isActive: boolean;
  shouldFlagMissingManager: boolean;
};

export type EmployeeMasterSummary = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  employeesMissingManager: number;
};

export type EmployeeMasterFilterOptions = {
  departments: string[];
  roles: string[];
  managers: Array<{ id: string; name: string }>;
  employmentClassifications: string[];
};

export type EmployeeMasterReportResult = {
  summary: EmployeeMasterSummary;
  filters: EmployeeMasterFilters;
  filterOptions: EmployeeMasterFilterOptions;
  rows: EmployeeMasterRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
};

type EmployeeMasterShadowWarning =
  | "TENANT_CONTEXT_ORGANIZATION_ID_MISSING"
  | "REPORT_EMPLOYEES_MISSING_ORGANIZATION"
  | "TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES";

type EmployeeMasterBaseData = {
  allRows: EmployeeMasterRow[];
  filterOptions: EmployeeMasterFilterOptions;
};

type EmployeeMasterShadowRow = EmployeeMasterRow & {
  organizationId: string | null;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(value: string | undefined): EmployeeMasterStatusFilter {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ALL"
    ? value
    : "ACTIVE";
}

function normalizeSortKey(value: string | undefined): EmployeeMasterSortKey {
  return value === "status" ||
    value === "department" ||
    value === "managerName" ||
    value === "hireDate"
    ? value
    : "employeeName";
}

function normalizeSortDirection(value: string | undefined): EmployeeMasterSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getEmployeeMasterFilters(input: {
  status?: string;
  department?: string;
  role?: string;
  manager?: string;
  search?: string;
  employmentClassification?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): EmployeeMasterFilters {
  return {
    status: normalizeStatusFilter(input.status),
    department: normalizeString(input.department),
    role: normalizeString(input.role),
    managerId: normalizeString(input.manager),
    search: normalizeString(input.search),
    employmentClassification: normalizeString(input.employmentClassification),
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

  return {
    roleCodes,
    roleDisplay: roleCodes.length > 0 ? roleCodes.join(", ") : "-",
  };
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
  rows: EmployeeMasterRow[],
  sort: EmployeeMasterSortKey,
  direction: EmployeeMasterSortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const employeeNameCompare = left.employeeName.localeCompare(right.employeeName);

    const compareValue = (() => {
      switch (sort) {
        case "status":
          return left.status.localeCompare(right.status) || employeeNameCompare;
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

function filterEmployeeMasterRows<T extends EmployeeMasterRow>(
  allRows: T[],
  filters: EmployeeMasterFilters
) {
  const searchValue = filters.search.toLowerCase();

  return allRows.filter((row) => {
    const matchesStatus =
      filters.status === "ALL"
        ? true
        : filters.status === "ACTIVE"
          ? row.isActive
          : !row.isActive;

    const matchesDepartment =
      filters.department === "" || row.department === filters.department;

    const matchesRole =
      filters.role === "" || row.roleCodes.includes(filters.role);

    const matchesManager =
      filters.managerId === "" || row.managerId === filters.managerId;

    const matchesSearch =
      searchValue === "" ||
      row.employeeName.toLowerCase().includes(searchValue) ||
      row.employeeIdentifier.toLowerCase().includes(searchValue);

    const matchesEmploymentClassification =
      filters.employmentClassification === "" ||
      row.employmentClassification === filters.employmentClassification;

    return (
      matchesStatus &&
      matchesDepartment &&
      matchesRole &&
      matchesManager &&
      matchesSearch &&
      matchesEmploymentClassification
    );
  });
}

async function getEmployeeMasterBaseData(): Promise<EmployeeMasterBaseData> {
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

  const allRows: EmployeeMasterRow[] = employees.map((employee) => {
    const { roleCodes, roleDisplay } = getRoleDisplay(employee.roleAssignments);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeIdentifier: employee.id,
      status: employee.status,
      jobTitle: employee.title ?? null,
      department: employee.department ?? null,
      managerName: employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim()
        : null,
      managerId: employee.manager?.id ?? null,
      role: roleDisplay,
      roleCodes,
      hireDate: employee.hireDate.toISOString(),
      workLocation: employee.workLocation ?? null,
      employmentClassification: employee.employmentClassification ?? null,
      workEmail: employee.email,
      payrollFrequency: employee.payrollFrequency,
      isActive: employee.status === "ACTIVE",
      shouldFlagMissingManager: shouldFlagMissingManager({
        status: employee.status,
        managerId: employee.managerId,
        roleCodes,
      }),
    };
  });

  return {
    allRows,
    filterOptions: {
      departments: Array.from(
        new Set(
          allRows
            .map((row) => row.department)
            .filter((department): department is string => Boolean(department))
        )
      ).sort((left, right) => left.localeCompare(right)),
      roles: Array.from(
        new Set(allRows.flatMap((row) => row.roleCodes))
      ).sort((left, right) => left.localeCompare(right)),
      managers: Array.from(
        new Map(
          allRows
            .filter((row) => row.managerId && row.managerName)
            .map((row) => [
              row.managerId!,
              {
                id: row.managerId!,
                name: row.managerName!,
              },
            ])
        ).values()
      ).sort((left, right) => left.name.localeCompare(right.name)),
      employmentClassifications: Array.from(
        new Set(
          allRows
            .map((row) => row.employmentClassification)
            .filter(
              (
                employmentClassification
              ): employmentClassification is string =>
                Boolean(employmentClassification)
            )
        )
      ).sort((left, right) => left.localeCompare(right)),
    },
  };
}

async function getEmployeeMasterShadowBaseRows(): Promise<EmployeeMasterShadowRow[]> {
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
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return employees.map((employee) => {
    const { roleCodes, roleDisplay } = getRoleDisplay(employee.roleAssignments);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeIdentifier: employee.id,
      status: employee.status,
      jobTitle: employee.title ?? null,
      department: employee.department ?? null,
      managerName: employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim()
        : null,
      managerId: employee.manager?.id ?? null,
      role: roleDisplay,
      roleCodes,
      hireDate: employee.hireDate.toISOString(),
      workLocation: employee.workLocation ?? null,
      employmentClassification: employee.employmentClassification ?? null,
      workEmail: employee.email,
      payrollFrequency: employee.payrollFrequency,
      isActive: employee.status === "ACTIVE",
      shouldFlagMissingManager: shouldFlagMissingManager({
        status: employee.status,
        managerId: employee.managerId,
        roleCodes,
      }),
      organizationId: employee.organizationId,
    };
  });
}

function buildEmployeeMasterReportResult(
  allRows: EmployeeMasterRow[],
  filterOptions: EmployeeMasterFilterOptions,
  filters: EmployeeMasterFilters
): EmployeeMasterReportResult {
  const filteredRows = filterEmployeeMasterRows(allRows, filters);

  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    summary: {
      totalEmployees: filteredRows.length,
      activeEmployees: filteredRows.filter((row) => row.isActive).length,
      inactiveEmployees: filteredRows.filter((row) => !row.isActive).length,
      employeesMissingManager: filteredRows.filter(
        (row) => row.shouldFlagMissingManager
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
  };
}

export async function getEmployeeMasterReport(
  filters: EmployeeMasterFilters
): Promise<EmployeeMasterReportResult> {
  const { allRows, filterOptions } = await getEmployeeMasterBaseData();
  return buildEmployeeMasterReportResult(allRows, filterOptions, filters);
}

export async function getEmployeeMasterExportRows(filters: EmployeeMasterFilters) {
  const { allRows, filterOptions } = await getEmployeeMasterBaseData();
  const report = buildEmployeeMasterReportResult(allRows, filterOptions, {
    ...filters,
    page: 1,
    pageSize: Math.max(allRows.length, 1),
  });

  return report.rows;
}

export async function getEmployeeMasterReportTenantShadowCompare(input: {
  filters: EmployeeMasterFilters;
  tenantContext: TenantContext;
}) {
  const allRows = await getEmployeeMasterShadowBaseRows();
  const currentReportRows = filterEmployeeMasterRows(allRows, input.filters);
  const warnings: EmployeeMasterShadowWarning[] = [];

  if (!input.tenantContext.organizationId) {
    warnings.push("TENANT_CONTEXT_ORGANIZATION_ID_MISSING");
  }

  const missingOrganizationRows = currentReportRows.filter(
    (row) => !row.organizationId
  );

  if (missingOrganizationRows.length > 0) {
    warnings.push("REPORT_EMPLOYEES_MISSING_ORGANIZATION");
  }

  const tenantScopedReportRows = input.tenantContext.organizationId
    ? currentReportRows.filter(
        (row) => row.organizationId === input.tenantContext.organizationId
      )
    : currentReportRows;

  const tenantScopedIds = new Set(
    tenantScopedReportRows.map((row) => row.employeeId)
  );
  const excludedByTenantFilter = input.tenantContext.organizationId
    ? currentReportRows
        .filter((row) => !tenantScopedIds.has(row.employeeId))
        .map((row) => ({
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          workEmail: row.workEmail,
          status: row.status,
          department: row.department,
          managerName: row.managerName,
          organizationId: row.organizationId,
        }))
    : [];

  if (excludedByTenantFilter.length > 0) {
    warnings.push("TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES");
  }

  return {
    tenantContextOrganizationId: input.tenantContext.organizationId,
    filters: {
      status: input.filters.status,
      department: input.filters.department,
      role: input.filters.role,
      managerId: input.filters.managerId,
      search: input.filters.search,
      employmentClassification: input.filters.employmentClassification,
      sort: input.filters.sort,
      direction: input.filters.direction,
    },
    counts: {
      currentReportEmployeeCount: currentReportRows.length,
      tenantScopedReportEmployeeCount: tenantScopedReportRows.length,
      missingOrganizationCount: missingOrganizationRows.length,
      excludedByTenantFilterCount: excludedByTenantFilter.length,
    },
    excludedByTenantFilter,
    warnings,
  };
}
