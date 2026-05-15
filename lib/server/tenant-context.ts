import { prisma } from "../db";
import { getCurrentUser } from "../auth/current-user";
import { getEmployeePermissions, getEmployeeRoles } from "../auth/permissions";

const DEFAULT_ORGANIZATION_SLUG = "default-org";

export type TenantContextSource =
  | "employee_session"
  | "linked_user"
  | "organization_membership"
  | "transition_default_organization"
  | "internal_job"
  | "system";

export type TenantContextWarning =
  | "EMPLOYEE_NOT_AUTHENTICATED"
  | "EMPLOYEE_USER_LINK_MISSING"
  | "EMPLOYEE_ORGANIZATION_MISSING"
  | "DEFAULT_ORGANIZATION_FALLBACK_USED"
  | "DEFAULT_ORGANIZATION_NOT_FOUND"
  | "LINKED_USER_NOT_FOUND"
  | "LINKED_USER_WITHOUT_IDENTITY"
  | "LINKED_USER_WITHOUT_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION"
  | "LINKED_USER_HAS_DIFFERENT_ORGANIZATION_MEMBERSHIP";

export type TenantContext = {
  organizationId: string | null;
  userId: string | null;
  employeeId: string | null;
  roleCodes: string[];
  permissionCodes: string[];
  source: TenantContextSource;
  warnings: TenantContextWarning[];
  organization: {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null;
  user: {
    id: string;
    email: string;
    isActive: boolean;
    identityCount: number;
    membershipCount: number;
  } | null;
  membership: {
    id: string;
    organizationId: string;
    role: string | null;
    status: string;
  } | null;
};

export async function resolveTenantContext(): Promise<TenantContext> {
  const employee = await getCurrentUser();

  if (!employee) {
    return {
      organizationId: null,
      userId: null,
      employeeId: null,
      roleCodes: [],
      permissionCodes: [],
      source: "employee_session",
      warnings: ["EMPLOYEE_NOT_AUTHENTICATED"],
      organization: null,
      user: null,
      membership: null,
    };
  }

  const [roleCodes, permissionCodes] = await Promise.all([
    getEmployeeRoles(employee.id),
    getEmployeePermissions(employee.id),
  ]);

  const warnings: TenantContextWarning[] = [];
  let source: TenantContextSource = "employee_session";
  let resolvedOrganizationId = employee.organizationId;
  let organization:
    | {
        id: string;
        slug: string;
        name: string;
        status: string;
      }
    | null = null;

  if (!employee.userId) {
    warnings.push("EMPLOYEE_USER_LINK_MISSING");
  }

  if (!employee.organizationId) {
    warnings.push("EMPLOYEE_ORGANIZATION_MISSING");
  }

  if (employee.organizationId) {
    organization = await prisma.organization.findUnique({
      where: { id: employee.organizationId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    });
  } else {
    const defaultOrganization = await prisma.organization.findUnique({
      where: {
        slug: DEFAULT_ORGANIZATION_SLUG,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    });

    if (defaultOrganization) {
      resolvedOrganizationId = defaultOrganization.id;
      organization = defaultOrganization;
      source = "transition_default_organization";
      warnings.push("DEFAULT_ORGANIZATION_FALLBACK_USED");
    } else {
      warnings.push("DEFAULT_ORGANIZATION_NOT_FOUND");
    }
  }

  let user:
    | {
        id: string;
        email: string;
        isActive: boolean;
        identityCount: number;
        membershipCount: number;
      }
    | null = null;
  let membership:
    | {
        id: string;
        organizationId: string;
        role: string | null;
        status: string;
      }
    | null = null;

  if (employee.userId) {
    const linkedUser = await prisma.user.findUnique({
      where: { id: employee.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        identities: {
          select: {
            id: true,
          },
        },
        memberships: {
          select: {
            id: true,
            organizationId: true,
            role: true,
            status: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!linkedUser) {
      warnings.push("LINKED_USER_NOT_FOUND");
    } else {
      source =
        source === "transition_default_organization" ? source : "linked_user";
      user = {
        id: linkedUser.id,
        email: linkedUser.email,
        isActive: linkedUser.isActive,
        identityCount: linkedUser.identities.length,
        membershipCount: linkedUser.memberships.length,
      };

      if (linkedUser.identities.length === 0) {
        warnings.push("LINKED_USER_WITHOUT_IDENTITY");
      }

      const matchingMembership =
        linkedUser.memberships.find(
          (candidate) => candidate.organizationId === resolvedOrganizationId
        ) ?? null;
      const membershipsInDifferentOrganizations = linkedUser.memberships.filter(
        (candidate) => candidate.organizationId !== resolvedOrganizationId
      );

      if (matchingMembership) {
        membership = {
          id: matchingMembership.id,
          organizationId: matchingMembership.organizationId,
          role: matchingMembership.role,
          status: matchingMembership.status,
        };
        source = "organization_membership";
      } else if (resolvedOrganizationId) {
        warnings.push(
          "LINKED_USER_WITHOUT_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION"
        );

        if (membershipsInDifferentOrganizations.length > 0) {
          warnings.push("LINKED_USER_HAS_DIFFERENT_ORGANIZATION_MEMBERSHIP");
        }
      }
    }
  }

  return {
    organizationId: resolvedOrganizationId,
    userId: employee.userId,
    employeeId: employee.id,
    roleCodes,
    permissionCodes,
    source,
    warnings,
    organization,
    user,
    membership,
  };
}
