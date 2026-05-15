import { prisma } from "../../db";
import { getVisibleEmployeeIds } from "../employee-visibility";
import type { TenantContext } from "../tenant-context";

type StatusHistoryRow = {
  id: string;
  employeeId: string;
  previousStatus: string;
  newStatus: string;
  changedByEmployeeId: string;
  changedAt: Date;
};

type EmployeeStatusHistoryReader = {
  employeeStatusHistory: {
    findMany(args: {
      where: { employeeId: string };
      orderBy: { changedAt: "asc" | "desc" }[];
    }): Promise<StatusHistoryRow[]>;
  };
};

type EmployeeDirectoryShadowWarning =
  | "TENANT_CONTEXT_ORGANIZATION_ID_MISSING"
  | "VISIBLE_EMPLOYEES_MISSING_ORGANIZATION"
  | "TENANT_FILTER_EXCLUDES_VISIBLE_EMPLOYEES";

async function getEmployeeStatusHistoryEntries(employeeId: string) {
  const rows = await (prisma as typeof prisma & EmployeeStatusHistoryReader)
    .employeeStatusHistory.findMany({
      where: { employeeId },
      orderBy: [{ changedAt: "desc" }],
    });

  const changedByIds = Array.from(
    new Set(rows.map((entry) => entry.changedByEmployeeId))
  );

  const changedByEmployees = changedByIds.length
    ? await prisma.employee.findMany({
        where: {
          id: { in: changedByIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      })
    : [];

  const changedByMap = new Map(
    changedByEmployees.map((changedByEmployee) => [
      changedByEmployee.id,
      `${changedByEmployee.firstName} ${changedByEmployee.lastName}`,
    ])
  );

  return rows.map((entry) => ({
    ...entry,
    changedByName: changedByMap.get(entry.changedByEmployeeId) ?? entry.changedByEmployeeId,
  }));
}

export async function getEmployeeDirectoryEmployees(actorId: string) {
  const visibleEmployeeIds = await getVisibleEmployeeIds(actorId);

  return prisma.employee.findMany({
    where: {
      id: {
        in: visibleEmployeeIds,
      },
    },
    include: {
      manager: true,
      ledger: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getEmployeeDirectoryTenantShadowCompare(input: {
  actorId: string;
  tenantContext: TenantContext;
}) {
  const visibleEmployeeIds = await getVisibleEmployeeIds(input.actorId);
  const currentVisibleEmployees = await prisma.employee.findMany({
    where: {
      id: {
        in: visibleEmployeeIds,
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      organizationId: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const warnings: EmployeeDirectoryShadowWarning[] = [];
  const missingOrganizationEmployees = currentVisibleEmployees.filter(
    (employee) => !employee.organizationId
  );

  if (!input.tenantContext.organizationId) {
    warnings.push("TENANT_CONTEXT_ORGANIZATION_ID_MISSING");
  }

  if (missingOrganizationEmployees.length > 0) {
    warnings.push("VISIBLE_EMPLOYEES_MISSING_ORGANIZATION");
  }

  const tenantScopedVisibleEmployees = input.tenantContext.organizationId
    ? await prisma.employee.findMany({
        where: {
          id: {
            in: visibleEmployeeIds,
          },
          organizationId: input.tenantContext.organizationId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          organizationId: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : currentVisibleEmployees;

  const tenantScopedIdSet = new Set(
    tenantScopedVisibleEmployees.map((employee) => employee.id)
  );
  const excludedByTenantFilter = input.tenantContext.organizationId
    ? currentVisibleEmployees
        .filter((employee) => !tenantScopedIdSet.has(employee.id))
        .map((employee) => ({
          id: employee.id,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          status: employee.status,
          organizationId: employee.organizationId,
        }))
    : [];

  if (excludedByTenantFilter.length > 0) {
    warnings.push("TENANT_FILTER_EXCLUDES_VISIBLE_EMPLOYEES");
  }

  return {
    tenantContextOrganizationId: input.tenantContext.organizationId,
    counts: {
      currentVisibleEmployeeCount: currentVisibleEmployees.length,
      tenantScopedVisibleEmployeeCount: tenantScopedVisibleEmployees.length,
      missingOrganizationCount: missingOrganizationEmployees.length,
      excludedByTenantFilterCount: excludedByTenantFilter.length,
    },
    currentVisibleEmployees: currentVisibleEmployees.map((employee) => ({
      id: employee.id,
      email: employee.email,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      status: employee.status,
      organizationId: employee.organizationId,
    })),
    excludedByTenantFilter,
    warnings,
  };
}

export async function getEmployeeProfilePageData(input: {
  employeeId: string;
  includeAdminOptions: boolean;
  includePrivateInfo?: boolean;
  includeBenefits?: boolean;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    include: {
      manager: true,
      directReports: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          department: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      },
      ledger: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
      requests: {
        orderBy: [{ createdAt: "desc" }],
      },
      roleAssignments: {
        where: { isActive: true },
        include: { role: true },
      },
      ...(input.includeAdminOptions
        ? {
            compensationProfile: true,
          }
        : {}),
      ...(input.includePrivateInfo
        ? {
            contactInfo: true,
            emergencyContacts: {
              orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
            },
          }
        : {}),
      ...(input.includeBenefits
        ? {
            benefitElections: {
              orderBy: [
                { effectiveDate: "desc" },
                { createdAt: "desc" },
              ],
            },
          }
        : {}),
    },
  });

  if (!employee) {
    return {
      employee: null,
      managerOptions: [],
      allRoles: [],
      statusHistoryEntries: [],
    };
  }

  if (!input.includeAdminOptions) {
    const statusHistoryEntries = await getEmployeeStatusHistoryEntries(employee.id);

    return {
      employee,
      managerOptions: [],
      allRoles: [],
      statusHistoryEntries,
    };
  }

  const [managerOptions, allRoles, statusHistoryEntries] = await Promise.all([
    prisma.employee.findMany({
      where: {
        id: { not: employee.id },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.role.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getEmployeeStatusHistoryEntries(employee.id),
  ]);

  return {
    employee,
    managerOptions,
    allRoles,
    statusHistoryEntries,
  };
}
