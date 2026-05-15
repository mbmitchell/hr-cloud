import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";

const DEFAULT_MEMBERSHIP_ROLE = "MEMBER";
const DEFAULT_MEMBERSHIP_STATUS = "ACTIVE";

type OrganizationMembershipBackfillAction =
  | "CREATE_MEMBERSHIP"
  | "EXISTING_MEMBERSHIP"
  | "SKIP_MISSING_USER"
  | "SKIP_MISSING_ORGANIZATION"
  | "SKIP_USER_NOT_FOUND"
  | "SKIP_ORGANIZATION_NOT_FOUND";

type OrganizationMembershipPreviewRow = {
  employeeId: string;
  employeeEmail: string;
  userId: string | null;
  organizationId: string | null;
  action: OrganizationMembershipBackfillAction;
  reason: string | null;
  existingMembershipId: string | null;
};

type OrganizationMembershipBackfillRow = OrganizationMembershipPreviewRow & {
  applied: boolean;
  createdMembershipId: string | null;
};

async function getOrganizationMembershipBackfillBaseData() {
  const [employees, users, organizations, memberships] = await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        email: true,
        userId: true,
        organizationId: true,
      },
      orderBy: {
        email: "asc",
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
      },
    }),
    prisma.organization.findMany({
      select: {
        id: true,
      },
    }),
    prisma.organizationMembership.findMany({
      select: {
        id: true,
        organizationId: true,
        userId: true,
        role: true,
        status: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const userIds = new Set(users.map((user) => user.id));
  const organizationIds = new Set(organizations.map((organization) => organization.id));
  const membershipByKey = new Map(
    memberships.map((membership) => [
      `${membership.organizationId}:${membership.userId}`,
      membership,
    ])
  );

  return {
    employees,
    userIds,
    organizationIds,
    memberships,
    membershipByKey,
  };
}

function buildOrganizationMembershipPreviewRows(
  input: Awaited<ReturnType<typeof getOrganizationMembershipBackfillBaseData>>
) {
  const rows: OrganizationMembershipPreviewRow[] = [];

  for (const employee of input.employees) {
    const organizationId = employee.organizationId ?? null;
    const userId = employee.userId ?? null;

    if (!userId) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        userId,
        organizationId,
        action: "SKIP_MISSING_USER",
        reason: "employee_user_id_missing",
        existingMembershipId: null,
      });
      continue;
    }

    if (!organizationId) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        userId,
        organizationId,
        action: "SKIP_MISSING_ORGANIZATION",
        reason: "employee_organization_id_missing",
        existingMembershipId: null,
      });
      continue;
    }

    if (!input.userIds.has(userId)) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        userId,
        organizationId,
        action: "SKIP_USER_NOT_FOUND",
        reason: "linked_user_not_found",
        existingMembershipId: null,
      });
      continue;
    }

    if (!input.organizationIds.has(organizationId)) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        userId,
        organizationId,
        action: "SKIP_ORGANIZATION_NOT_FOUND",
        reason: "linked_organization_not_found",
        existingMembershipId: null,
      });
      continue;
    }

    const existingMembership =
      input.membershipByKey.get(`${organizationId}:${userId}`) ?? null;

    if (existingMembership) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        userId,
        organizationId,
        action: "EXISTING_MEMBERSHIP",
        reason: null,
        existingMembershipId: existingMembership.id,
      });
      continue;
    }

    rows.push({
      employeeId: employee.id,
      employeeEmail: employee.email,
      userId,
      organizationId,
      action: "CREATE_MEMBERSHIP",
      reason: null,
      existingMembershipId: null,
    });
  }

  return rows;
}

export async function previewOrganizationMembershipBackfill() {
  const data = await getOrganizationMembershipBackfillBaseData();
  const rows = buildOrganizationMembershipPreviewRows(data);

  return {
    defaults: {
      role: DEFAULT_MEMBERSHIP_ROLE,
      status: DEFAULT_MEMBERSHIP_STATUS,
    },
    totals: {
      totalEmployees: data.employees.length,
      linkedEmployeesWithUserAndOrganization: data.employees.filter(
        (employee) => employee.userId && employee.organizationId
      ).length,
      existingMemberships: rows.filter(
        (row) => row.action === "EXISTING_MEMBERSHIP"
      ).length,
      missingMemberships: rows.filter(
        (row) => row.action === "CREATE_MEMBERSHIP"
      ).length,
      skippedRecords: rows.filter((row) =>
        row.action.startsWith("SKIP_")
      ).length,
    },
    countsByAction: {
      createMembership: rows.filter((row) => row.action === "CREATE_MEMBERSHIP")
        .length,
      existingMembership: rows.filter(
        (row) => row.action === "EXISTING_MEMBERSHIP"
      ).length,
      skipMissingUser: rows.filter((row) => row.action === "SKIP_MISSING_USER")
        .length,
      skipMissingOrganization: rows.filter(
        (row) => row.action === "SKIP_MISSING_ORGANIZATION"
      ).length,
      skipUserNotFound: rows.filter((row) => row.action === "SKIP_USER_NOT_FOUND")
        .length,
      skipOrganizationNotFound: rows.filter(
        (row) => row.action === "SKIP_ORGANIZATION_NOT_FOUND"
      ).length,
    },
    rows,
  };
}

async function writeMembershipBackfillAuditLog(input: {
  actorId: string;
  action: string;
  payload: Record<string, unknown>;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: input.action,
    entityType: "OrganizationMembership",
    entityId: "backfill",
    newValue: input.payload,
  });
}

export async function backfillOrganizationMemberships(input: {
  actorId: string;
  apply: boolean;
}) {
  const preview = await previewOrganizationMembershipBackfill();
  const results: OrganizationMembershipBackfillRow[] = [];

  for (const row of preview.rows) {
    if (!input.apply) {
      results.push({
        ...row,
        applied: false,
        createdMembershipId: null,
      });
      continue;
    }

    if (row.action !== "CREATE_MEMBERSHIP") {
      results.push({
        ...row,
        applied: false,
        createdMembershipId: null,
      });
      continue;
    }

    try {
      const appliedResult = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: row.employeeId },
          select: {
            id: true,
            email: true,
            userId: true,
            organizationId: true,
          },
        });

        if (!employee?.userId) {
          return {
            applied: false,
            action: "SKIP_MISSING_USER" as const,
            reason: "employee_user_id_missing",
            existingMembershipId: null as string | null,
            createdMembershipId: null as string | null,
          };
        }

        if (!employee.organizationId) {
          return {
            applied: false,
            action: "SKIP_MISSING_ORGANIZATION" as const,
            reason: "employee_organization_id_missing",
            existingMembershipId: null as string | null,
            createdMembershipId: null as string | null,
          };
        }

        const [user, organization, existingMembership] = await Promise.all([
          tx.user.findUnique({
            where: { id: employee.userId },
            select: { id: true },
          }),
          tx.organization.findUnique({
            where: { id: employee.organizationId },
            select: { id: true },
          }),
          tx.organizationMembership.findUnique({
            where: {
              organizationId_userId: {
                organizationId: employee.organizationId,
                userId: employee.userId,
              },
            },
            select: {
              id: true,
            },
          }),
        ]);

        if (!user) {
          return {
            applied: false,
            action: "SKIP_USER_NOT_FOUND" as const,
            reason: "linked_user_not_found",
            existingMembershipId: null as string | null,
            createdMembershipId: null as string | null,
          };
        }

        if (!organization) {
          return {
            applied: false,
            action: "SKIP_ORGANIZATION_NOT_FOUND" as const,
            reason: "linked_organization_not_found",
            existingMembershipId: null as string | null,
            createdMembershipId: null as string | null,
          };
        }

        if (existingMembership) {
          return {
            applied: false,
            action: "EXISTING_MEMBERSHIP" as const,
            reason: null,
            existingMembershipId: existingMembership.id,
            createdMembershipId: null as string | null,
          };
        }

        const membership = await tx.organizationMembership.create({
          data: {
            organizationId: employee.organizationId,
            userId: employee.userId,
            role: DEFAULT_MEMBERSHIP_ROLE,
            status: DEFAULT_MEMBERSHIP_STATUS,
          },
          select: {
            id: true,
          },
        });

        return {
          applied: true,
          action: "CREATE_MEMBERSHIP" as const,
          reason: null,
          existingMembershipId: null as string | null,
          createdMembershipId: membership.id,
        };
      });

      results.push({
        ...row,
        action: appliedResult.action,
        reason: appliedResult.reason,
        existingMembershipId:
          appliedResult.existingMembershipId ?? row.existingMembershipId,
        applied: appliedResult.applied,
        createdMembershipId: appliedResult.createdMembershipId,
      });
    } catch (error) {
      results.push({
        ...row,
        reason:
          error instanceof Error
            ? error.message
            : "unknown_membership_backfill_error",
        applied: false,
        createdMembershipId: null,
      });
    }
  }

  const summary = {
    apply: input.apply,
    defaultRole: DEFAULT_MEMBERSHIP_ROLE,
    defaultStatus: DEFAULT_MEMBERSHIP_STATUS,
    totalRows: results.length,
    appliedRows: results.filter((row) => row.applied).length,
    createdMemberships: results.filter((row) => Boolean(row.createdMembershipId))
      .length,
    existingMemberships: results.filter(
      (row) => row.action === "EXISTING_MEMBERSHIP"
    ).length,
    skippedRows: results.filter((row) => row.action.startsWith("SKIP_")).length,
  };

  await writeMembershipBackfillAuditLog({
    actorId: input.actorId,
    action: input.apply
      ? "ORGANIZATION_MEMBERSHIP_BACKFILL_APPLY"
      : "ORGANIZATION_MEMBERSHIP_BACKFILL_PREVIEW",
    payload: {
      summary,
      rows: results.filter(
        (row) =>
          row.action !== "EXISTING_MEMBERSHIP" ||
          row.applied ||
          row.createdMembershipId
      ),
    },
  });

  for (const row of results) {
    if (!row.applied && row.reason) {
      console.warn(
        JSON.stringify({
          eventType: "ORGANIZATION_MEMBERSHIP_BACKFILL_SKIPPED",
          employeeId: row.employeeId,
          employeeEmail: row.employeeEmail,
          action: row.action,
          reason: row.reason,
        })
      );
    }
  }

  return {
    summary,
    rows: results,
  };
}
