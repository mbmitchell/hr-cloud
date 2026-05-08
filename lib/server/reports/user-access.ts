import { prisma } from "../../db";

export type UserAccessStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
export type UserAccessLevelFilter =
  | "ALL"
  | "STANDARD"
  | "MANAGER"
  | "ELEVATED"
  | "MISSING_ROLE";
export type UserAccessSortKey =
  | "employeeName"
  | "status"
  | "department"
  | "managerName"
  | "hireDate";
export type UserAccessSortDirection = "asc" | "desc";

export type UserAccessFilters = {
  status: UserAccessStatusFilter;
  role: string;
  department: string;
  managerId: string;
  search: string;
  accessLevel: UserAccessLevelFilter;
  sort: UserAccessSortKey;
  direction: UserAccessSortDirection;
  page: number;
  pageSize: number;
};

export type UserAccessRow = {
  employeeId: string;
  employeeName: string;
  employeeIdentifier: string;
  status: string;
  department: string | null;
  managerId: string | null;
  managerName: string | null;
  currentRoles: string;
  roleCodes: string[];
  accessLevel: UserAccessLevelFilter;
  workEmail: string;
  hireDate: string;
  jobTitle: string | null;
  workLocation: string | null;
  isActive: boolean;
};

export type UserAccessSummary = {
  totalEmployees: number;
  activeEmployees: number;
  usersWithElevatedAccess: number;
  employeesMissingRoleAssignment: number;
};

export type UserAccessFilterOptions = {
  roles: string[];
  departments: string[];
  managers: Array<{ id: string; name: string }>;
};

export type UserAccessReportResult = {
  summary: UserAccessSummary;
  filters: UserAccessFilters;
  filterOptions: UserAccessFilterOptions;
  rows: UserAccessRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
};

type UserAccessBaseData = {
  allRows: UserAccessRow[];
  filterOptions: UserAccessFilterOptions;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeStatusFilter(value: string | undefined): UserAccessStatusFilter {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ALL"
    ? value
    : "ACTIVE";
}

function normalizeAccessLevelFilter(
  value: string | undefined
): UserAccessLevelFilter {
  return value === "STANDARD" ||
    value === "MANAGER" ||
    value === "ELEVATED" ||
    value === "MISSING_ROLE" ||
    value === "ALL"
    ? value
    : "ALL";
}

function normalizeSortKey(value: string | undefined): UserAccessSortKey {
  return value === "status" ||
    value === "department" ||
    value === "managerName" ||
    value === "hireDate"
    ? value
    : "employeeName";
}

function normalizeSortDirection(value: string | undefined): UserAccessSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getUserAccessFilters(input: {
  status?: string;
  role?: string;
  department?: string;
  manager?: string;
  search?: string;
  accessLevel?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}): UserAccessFilters {
  return {
    status: normalizeStatusFilter(input.status),
    role: normalizeString(input.role),
    department: normalizeString(input.department),
    managerId: normalizeString(input.manager),
    search: normalizeString(input.search),
    accessLevel: normalizeAccessLevelFilter(input.accessLevel),
    sort: normalizeSortKey(input.sort),
    direction: normalizeSortDirection(input.direction),
    page: normalizePositiveInt(input.page, 1),
    pageSize: Math.min(normalizePositiveInt(input.pageSize, 25), 100),
  };
}

function getRoleDisplay(roleCodes: string[]) {
  return roleCodes.length > 0 ? roleCodes.join(", ") : "No role assignment";
}

function getAccessLevel(roleCodes: string[]): UserAccessLevelFilter {
  if (roleCodes.length === 0) {
    return "MISSING_ROLE";
  }

  const elevatedRoleCodes = roleCodes.filter(
    (roleCode) => !["EMPLOYEE", "MANAGER"].includes(roleCode)
  );

  if (elevatedRoleCodes.length > 0) {
    return "ELEVATED";
  }

  if (roleCodes.includes("MANAGER")) {
    return "MANAGER";
  }

  return "STANDARD";
}

function sortRows(
  rows: UserAccessRow[],
  sort: UserAccessSortKey,
  direction: UserAccessSortDirection
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

async function getUserAccessBaseData(): Promise<UserAccessBaseData> {
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

  const allRows = employees.map((employee) => {
    const roleCodes = Array.from(
      new Set(
        employee.roleAssignments
          .map((assignment) => assignment.role.code)
          .filter((roleCode) => roleCode.trim() !== "")
      )
    ).sort();

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeIdentifier: employee.id,
      status: employee.status,
      department: employee.department ?? null,
      managerId: employee.manager?.id ?? null,
      managerName: employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim()
        : null,
      currentRoles: getRoleDisplay(roleCodes),
      roleCodes,
      accessLevel: getAccessLevel(roleCodes),
      workEmail: employee.email,
      hireDate: employee.hireDate.toISOString(),
      jobTitle: employee.title ?? null,
      workLocation: employee.workLocation ?? null,
      isActive: employee.status === "ACTIVE",
    } satisfies UserAccessRow;
  });

  return {
    allRows,
    filterOptions: {
      roles: Array.from(
        new Set(allRows.flatMap((row) => row.roleCodes))
      ).sort((left, right) => left.localeCompare(right)),
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
    },
  };
}

function buildUserAccessReportResult(
  allRows: UserAccessRow[],
  filterOptions: UserAccessFilterOptions,
  filters: UserAccessFilters
): UserAccessReportResult {
  const searchValue = filters.search.toLowerCase();

  const filteredRows = allRows.filter((row) => {
    const matchesStatus =
      filters.status === "ALL"
        ? true
        : filters.status === "ACTIVE"
          ? row.isActive
          : !row.isActive;

    const matchesRole =
      filters.role === "" || row.roleCodes.includes(filters.role);

    const matchesDepartment =
      filters.department === "" || row.department === filters.department;

    const matchesManager =
      filters.managerId === "" || row.managerId === filters.managerId;

    const matchesSearch =
      searchValue === "" ||
      row.employeeName.toLowerCase().includes(searchValue) ||
      row.employeeIdentifier.toLowerCase().includes(searchValue);

    const matchesAccessLevel =
      filters.accessLevel === "ALL" || row.accessLevel === filters.accessLevel;

    return (
      matchesStatus &&
      matchesRole &&
      matchesDepartment &&
      matchesManager &&
      matchesSearch &&
      matchesAccessLevel
    );
  });

  const sortedRows = sortRows(filteredRows, filters.sort, filters.direction);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    summary: {
      totalEmployees: filteredRows.length,
      activeEmployees: filteredRows.filter((row) => row.isActive).length,
      usersWithElevatedAccess: filteredRows.filter(
        (row) => row.accessLevel === "ELEVATED"
      ).length,
      employeesMissingRoleAssignment: filteredRows.filter(
        (row) => row.accessLevel === "MISSING_ROLE"
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

export async function getUserAccessReport(
  filters: UserAccessFilters
): Promise<UserAccessReportResult> {
  const { allRows, filterOptions } = await getUserAccessBaseData();
  return buildUserAccessReportResult(allRows, filterOptions, filters);
}

export async function getUserAccessExportRows(filters: UserAccessFilters) {
  const { allRows, filterOptions } = await getUserAccessBaseData();
  const report = buildUserAccessReportResult(allRows, filterOptions, {
    ...filters,
    page: 1,
    pageSize: Math.max(allRows.length, 1),
  });

  return report.rows;
}
