import { prisma } from "../db";
import { getDirectReportIds } from "../auth/access";
import { getEmployeePermissions, getEmployeeRoles } from "../auth/permissions";
import { canActorViewEmployee } from "./authorization";

function canViewAllEmployees(roleCodes: string[], permissionCodes: string[]) {
  return (
    roleCodes.some((roleCode) =>
      ["SITE_ADMIN", "HR_ADMIN", "EXECUTIVE_READONLY", "AUDITOR"].includes(
        roleCode
      )
    ) || permissionCodes.includes("VIEW_ALL_EMPLOYEES")
  );
}

export async function getVisibleEmployeeIds(actorId: string) {
  const [roleCodes, permissionCodes] = await Promise.all([
    getEmployeeRoles(actorId),
    getEmployeePermissions(actorId),
  ]);

  if (canViewAllEmployees(roleCodes, permissionCodes)) {
    const employees = await prisma.employee.findMany({
      select: { id: true },
    });

    return employees.map((employee) => employee.id);
  }

  const directReportIds = permissionCodes.includes("VIEW_TEAM_PROFILE")
    ? await getDirectReportIds(actorId)
    : [];

  const visibleEmployeeIds = new Set<string>([actorId]);

  for (const employeeId of directReportIds) {
    const allowed = canActorViewEmployee({
      actorId,
      employeeId,
      actorRoles: roleCodes,
      actorPermissions: permissionCodes,
      isManagerOfTarget: true,
    });

    if (allowed) {
      visibleEmployeeIds.add(employeeId);
    }
  }

  return Array.from(visibleEmployeeIds);
}

export async function filterEmployeesByVisibility<T extends { id: string }>(
  actorId: string,
  employees: T[]
) {
  return filterEmployeesByVisibleIds(employees, await getVisibleEmployeeIds(actorId));
}

export function filterEmployeesByVisibleIds<T extends { id: string }>(
  employees: T[],
  visibleEmployeeIds: Iterable<string>
) {
  const visibleEmployeeIdSet = new Set(visibleEmployeeIds);
  return employees.filter((employee) => visibleEmployeeIdSet.has(employee.id));
}
