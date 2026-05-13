import { prisma } from "../db";
import { getCurrentUser } from "./current-user";
import { getEmployeePermissions, getEmployeeRoles } from "./permissions";

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No current user found.");
  }

  return user;
}

export async function currentUserHasAnyRole(roleCodes: string[]) {
  const user = await requireCurrentUser();
  const roles = await getEmployeeRoles(user.id);

  return roleCodes.some((roleCode) => roles.includes(roleCode));
}

export async function currentUserHasPermission(permissionCode: string) {
  const user = await requireCurrentUser();
  const permissions = await getEmployeePermissions(user.id);
  return permissions.includes(permissionCode);
}

export async function canCurrentUserViewReports() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
    "ACCOUNTING",
    "EXECUTIVE_READONLY",
  ]);
}

export async function canCurrentUserViewAudit() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
    "AUDITOR",
  ]);
}

export async function canCurrentUserManageNotifications() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
  ]);
}

export async function canCurrentUserManageDocumentAcknowledgements() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
    "DOCUMENTS_ADMIN",
  ]);
}

export async function canCurrentUserManageAdjustments() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
  ]);
}

export async function canCurrentUserAccessAdjustmentsPage() {
  if (await canCurrentUserManageAdjustments()) {
    return true;
  }

  return currentUserHasPermission("ADD_COMP_TIME");
}

export async function canCurrentUserAddCompTimeFor(employeeId: string) {
  const user = await requireCurrentUser();

  if (await canCurrentUserManageAdjustments()) {
    return true;
  }

  const permissions = await getEmployeePermissions(user.id);

  if (!permissions.includes("ADD_COMP_TIME")) {
    return false;
  }

  if (user.id === employeeId) {
    return true;
  }

  const directReportIds = await getDirectReportIds(user.id);
  return directReportIds.includes(employeeId);
}

export async function canCurrentUserManageAccrualOverride() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
  ]);
}

export async function canCurrentUserRunAccruals() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
  ]);
}

export async function canCurrentUserManageCompensation() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
    "HR_ADMIN",
  ]);
}
export async function canCurrentUserRunRollover() {
  return currentUserHasAnyRole([
    "SITE_ADMIN",
  ]);
}

export async function getApprovalScope() {
  const user = await requireCurrentUser();
  const roles = await getEmployeeRoles(user.id);
  const permissions = await getEmployeePermissions(user.id);

  if (roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN")) {
    return {
      allowed: true,
      scope: "ALL" as const,
      user,
    };
  }

  if (permissions.includes("APPROVE_DIRECT_REPORT_REQUESTS")) {
    return {
      allowed: true,
      scope: "DIRECT_REPORTS" as const,
      user,
    };
  }

  return {
    allowed: false,
    scope: "NONE" as const,
    user,
  };
}

export async function getDirectReportIds(managerId: string) {
  const directReports = await prisma.employee.findMany({
    where: { managerId },
    select: { id: true },
  });

  return directReports.map((employee) => employee.id);
}
