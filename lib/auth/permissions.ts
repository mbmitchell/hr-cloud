import { prisma } from "../db";

export async function getEmployeeRoles(employeeId: string) {
  const assignments = await prisma.employeeRoleAssignment.findMany({
    where: {
      employeeId,
      isActive: true,
    },
    include: {
      role: true,
    },
  });

  return assignments.map((assignment) => assignment.role.code);
}

export async function getEmployeePermissions(employeeId: string) {
  const assignments = await prisma.employeeRoleAssignment.findMany({
    where: {
      employeeId,
      isActive: true,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const permissionCodes = new Set<string>();

  for (const assignment of assignments) {
    for (const rolePermission of assignment.role.rolePermissions) {
      permissionCodes.add(rolePermission.permission.code);
    }
  }

  return Array.from(permissionCodes);
}

export async function employeeHasPermission(
  employeeId: string,
  permissionCode: string
) {
  const permissions = await getEmployeePermissions(employeeId);
  return permissions.includes(permissionCode);
}

export async function isManagerOf(managerId: string, employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  });

  return employee?.managerId === managerId;
}