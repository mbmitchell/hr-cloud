import { prisma } from "../../db";
import { getVisibleEmployeeIds } from "../employee-visibility";

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

export async function getEmployeeProfilePageData(input: {
  employeeId: string;
  includeAdminOptions: boolean;
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
