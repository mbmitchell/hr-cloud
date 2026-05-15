import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";

type CoverageRisk = {
  type:
    | "EMPLOYEE_NORMALIZED_EMAIL_DUPLICATE"
    | "USER_NORMALIZED_EMAIL_DUPLICATE"
    | "EMPLOYEE_USER_EMAIL_MISMATCH"
    | "USER_LINKED_TO_MULTIPLE_EMPLOYEES";
  normalizedEmail?: string;
  employeeId?: string;
  userId?: string;
  relatedEmployeeIds?: string[];
  relatedUserIds?: string[];
};

type BackfillAction =
  | "LINK_EXISTING_USER"
  | "CREATE_USER_AND_LINK"
  | "SKIP_INVALID_EMAIL"
  | "SKIP_AMBIGUOUS_USER_EMAIL"
  | "SKIP_USER_LINKED_ELSEWHERE";

type BackfillPreviewRow = {
  employeeId: string;
  employeeEmail: string;
  normalizedEmail: string | null;
  existingUserId: string | null;
  action: BackfillAction;
  reason: string | null;
};

type BackfillResultRow = BackfillPreviewRow & {
  applied: boolean;
  createdUserId: string | null;
  linkedUserId: string | null;
};

type LinkedIdentityFlag =
  | "EMPLOYEE_NOT_LINKED"
  | "EMPLOYEE_EMAIL_DUPLICATE"
  | "USER_EMAIL_DUPLICATE"
  | "EMPLOYEE_USER_EMAIL_MISMATCH"
  | "USER_LINKED_TO_MULTIPLE_EMPLOYEES"
  | "USER_WITHOUT_IDENTITY"
  | "EMPLOYEE_MISSING_ORGANIZATION"
  | "USER_MISSING_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION"
  | "USER_HAS_MEMBERSHIP_IN_DIFFERENT_ORGANIZATION"
  | "MEMBERSHIP_INACTIVE";

type UnifiedReadinessStatus = "READY" | "NEEDS_REVIEW" | "NOT_READY";

function normalizeEmail(value: string | null | undefined) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return normalizedValue || null;
}

function buildEmailIndex<T extends { id: string; email: string }>(rows: T[]) {
  const map = new Map<string, T[]>();

  for (const row of rows) {
    const normalizedEmail = normalizeEmail(row.email);

    if (!normalizedEmail) {
      continue;
    }

    const existing = map.get(normalizedEmail) ?? [];
    existing.push(row);
    map.set(normalizedEmail, existing);
  }

  return map;
}

function buildUserToEmployeeIndex(
  employees: Array<{ id: string; userId: string | null }>
) {
  const map = new Map<string, string[]>();

  for (const employee of employees) {
    if (!employee.userId) {
      continue;
    }

    const existing = map.get(employee.userId) ?? [];
    existing.push(employee.id);
    map.set(employee.userId, existing);
  }

  return map;
}

function buildUserIdentityIndex(
  userIdentities: Array<{ userId: string }>
) {
  const map = new Map<string, Array<{ userId: string }>>();

  for (const identity of userIdentities) {
    const existing = map.get(identity.userId) ?? [];
    existing.push(identity);
    map.set(identity.userId, existing);
  }

  return map;
}

function buildMembershipByUserIndex(
  memberships: Array<{
    id: string;
    organizationId: string;
    userId: string;
    role: string | null;
    status: string;
  }>
) {
  const map = new Map<
    string,
    Array<{
      id: string;
      organizationId: string;
      userId: string;
      role: string | null;
      status: string;
    }>
  >();

  for (const membership of memberships) {
    const existing = map.get(membership.userId) ?? [];
    existing.push(membership);
    map.set(membership.userId, existing);
  }

  return map;
}

function buildOrganizationIndex(
  organizations: Array<{
    id: string;
    slug: string;
    name: string;
    status: string;
  }>
) {
  return new Map(organizations.map((organization) => [organization.id, organization]));
}

async function getIdentityLinkageBaseData() {
  const [employees, users, userIdentities, organizations, organizationMemberships] =
    await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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
        email: true,
        isActive: true,
      },
      orderBy: {
        email: "asc",
      },
    }),
    prisma.userIdentity.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        providerAccountId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.organization.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
      orderBy: {
        name: "asc",
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
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  return {
    employees,
    users,
    userIdentities,
    organizations,
    organizationMemberships,
    employeeEmailIndex: buildEmailIndex(employees),
    userEmailIndex: buildEmailIndex(users),
    userToEmployeeIndex: buildUserToEmployeeIndex(employees),
    userIdentityIndex: buildUserIdentityIndex(userIdentities),
    membershipByUserIndex: buildMembershipByUserIndex(organizationMemberships),
    organizationIndex: buildOrganizationIndex(organizations),
  };
}

function buildCoverageRisks(input: Awaited<ReturnType<typeof getIdentityLinkageBaseData>>) {
  const risks: CoverageRisk[] = [];

  for (const [normalizedEmail, employees] of input.employeeEmailIndex.entries()) {
    if (employees.length > 1) {
      risks.push({
        type: "EMPLOYEE_NORMALIZED_EMAIL_DUPLICATE",
        normalizedEmail,
        relatedEmployeeIds: employees.map((employee) => employee.id),
      });
    }
  }

  for (const [normalizedEmail, users] of input.userEmailIndex.entries()) {
    if (users.length > 1) {
      risks.push({
        type: "USER_NORMALIZED_EMAIL_DUPLICATE",
        normalizedEmail,
        relatedUserIds: users.map((user) => user.id),
      });
    }
  }

  for (const employee of input.employees) {
    if (!employee.userId) {
      continue;
    }

    const user = input.users.find((candidate) => candidate.id === employee.userId);

    if (
      user &&
      normalizeEmail(user.email) &&
      normalizeEmail(user.email) !== normalizeEmail(employee.email)
    ) {
      risks.push({
        type: "EMPLOYEE_USER_EMAIL_MISMATCH",
        normalizedEmail: normalizeEmail(employee.email) ?? undefined,
        employeeId: employee.id,
        userId: user.id,
      });
    }
  }

  for (const [userId, employeeIds] of input.userToEmployeeIndex.entries()) {
    if (employeeIds.length > 1) {
      risks.push({
        type: "USER_LINKED_TO_MULTIPLE_EMPLOYEES",
        userId,
        relatedEmployeeIds: employeeIds,
      });
    }
  }

  return risks;
}

function buildBackfillPreviewRows(
  input: Awaited<ReturnType<typeof getIdentityLinkageBaseData>>
) {
  const rows: BackfillPreviewRow[] = [];

  for (const employee of input.employees) {
    if (employee.userId) {
      continue;
    }

    const normalizedEmail = normalizeEmail(employee.email);

    if (!normalizedEmail) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        normalizedEmail: null,
        existingUserId: null,
        action: "SKIP_INVALID_EMAIL",
        reason: "invalid_or_blank_email",
      });
      continue;
    }

    const matchingUsers = input.userEmailIndex.get(normalizedEmail) ?? [];

    if (matchingUsers.length > 1) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        normalizedEmail,
        existingUserId: null,
        action: "SKIP_AMBIGUOUS_USER_EMAIL",
        reason: "multiple_users_share_normalized_email",
      });
      continue;
    }

    const existingUser = matchingUsers[0] ?? null;

    if (!existingUser) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        normalizedEmail,
        existingUserId: null,
        action: "CREATE_USER_AND_LINK",
        reason: null,
      });
      continue;
    }

    const linkedEmployeeIds = input.userToEmployeeIndex.get(existingUser.id) ?? [];

    if (linkedEmployeeIds.length > 0) {
      rows.push({
        employeeId: employee.id,
        employeeEmail: employee.email,
        normalizedEmail,
        existingUserId: existingUser.id,
        action: "SKIP_USER_LINKED_ELSEWHERE",
        reason: `user_already_linked_to_${linkedEmployeeIds.join(",")}`,
      });
      continue;
    }

    rows.push({
      employeeId: employee.id,
      employeeEmail: employee.email,
      normalizedEmail,
      existingUserId: existingUser.id,
      action: "LINK_EXISTING_USER",
      reason: null,
    });
  }

  return rows;
}

export async function getEmployeeLinkedIdentityDetails(employeeId: string) {
  const normalizedEmployeeId = String(employeeId || "").trim();

  if (!normalizedEmployeeId) {
    return null;
  }

  const data = await getIdentityLinkageBaseData();
  const employee = data.employees.find(
    (candidate) => candidate.id === normalizedEmployeeId
  );

  if (!employee) {
    return null;
  }

  const normalizedEmail = normalizeEmail(employee.email);
  const employeeEmailMatches = normalizedEmail
    ? data.employeeEmailIndex.get(normalizedEmail) ?? []
    : [];
  const userEmailMatches = normalizedEmail
    ? data.userEmailIndex.get(normalizedEmail) ?? []
    : [];

  const linkedUser = employee.userId
    ? await prisma.user.findUnique({
        where: { id: employee.userId },
        select: {
          id: true,
          email: true,
          isActive: true,
          memberships: {
            select: {
              id: true,
              organizationId: true,
              role: true,
              status: true,
              organization: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  status: true,
                },
              },
            },
            orderBy: [{ createdAt: "asc" }],
          },
          identities: {
            select: {
              provider: true,
              providerAccountId: true,
            },
            orderBy: [{ provider: "asc" }, { providerAccountId: "asc" }],
          },
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      })
    : null;

  const employeeOrganization = employee.organizationId
    ? await prisma.organization.findUnique({
        where: { id: employee.organizationId },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
        },
      })
    : null;

  const linkedEmployeeIds = employee.userId
    ? data.userToEmployeeIndex.get(employee.userId) ?? []
    : [];
  const matchingMembership = linkedUser?.memberships.find(
    (membership) => membership.organizationId === employee.organizationId
  ) ?? null;
  const membershipsInDifferentOrganizations =
    linkedUser?.memberships.filter(
      (membership) => membership.organizationId !== employee.organizationId
    ) ?? [];

  const flags: LinkedIdentityFlag[] = [];

  if (!employee.userId) {
    flags.push("EMPLOYEE_NOT_LINKED");
  }

  if (employeeEmailMatches.length > 1) {
    flags.push("EMPLOYEE_EMAIL_DUPLICATE");
  }

  if (userEmailMatches.length > 1) {
    flags.push("USER_EMAIL_DUPLICATE");
  }

  if (
    linkedUser &&
    normalizeEmail(linkedUser.email) &&
    normalizeEmail(linkedUser.email) !== normalizedEmail
  ) {
    flags.push("EMPLOYEE_USER_EMAIL_MISMATCH");
  }

  if (linkedEmployeeIds.length > 1) {
    flags.push("USER_LINKED_TO_MULTIPLE_EMPLOYEES");
  }

  if (linkedUser && linkedUser.identities.length === 0) {
    flags.push("USER_WITHOUT_IDENTITY");
  }

  if (!employee.organizationId) {
    flags.push("EMPLOYEE_MISSING_ORGANIZATION");
  }

  if (
    employee.organizationId &&
    employee.userId &&
    linkedUser &&
    !matchingMembership
  ) {
    flags.push("USER_MISSING_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION");
  }

  if (
    employee.organizationId &&
    linkedUser &&
    membershipsInDifferentOrganizations.length > 0 &&
    !matchingMembership
  ) {
    flags.push("USER_HAS_MEMBERSHIP_IN_DIFFERENT_ORGANIZATION");
  }

  if (matchingMembership && matchingMembership.status !== "ACTIVE") {
    flags.push("MEMBERSHIP_INACTIVE");
  }

  return {
    employee: {
      id: employee.id,
      email: employee.email,
      normalizedEmail,
      userId: employee.userId,
      organizationId: employee.organizationId,
    },
    organization: employeeOrganization
      ? {
          id: employeeOrganization.id,
          slug: employeeOrganization.slug,
          name: employeeOrganization.name,
          status: employeeOrganization.status,
        }
      : null,
    user: linkedUser
      ? {
          id: linkedUser.id,
          email: linkedUser.email,
          isActive: linkedUser.isActive,
          organizationMembershipCount: linkedUser._count.memberships,
        }
      : null,
    identities:
      linkedUser?.identities.map((identity) => ({
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
      })) ?? [],
    relatedRecords: {
      employeeEmailMatchCount: employeeEmailMatches.length,
      userEmailMatchCount: userEmailMatches.length,
      linkedEmployeeIdsForUser: linkedEmployeeIds,
    },
    membership: matchingMembership
      ? {
          id: matchingMembership.id,
          organizationId: matchingMembership.organizationId,
          role: matchingMembership.role,
          status: matchingMembership.status,
        }
      : null,
    membershipsInDifferentOrganizations: membershipsInDifferentOrganizations.map(
      (membership) => ({
        id: membership.id,
        organizationId: membership.organizationId,
        role: membership.role,
        status: membership.status,
        organization: {
          id: membership.organization.id,
          slug: membership.organization.slug,
          name: membership.organization.name,
          status: membership.organization.status,
        },
      })
    ),
    flags,
  };
}

export async function getIdentityLinkageCoverageSummary() {
  const data = await getIdentityLinkageBaseData();
  const risks = buildCoverageRisks(data);
  const previewRows = buildBackfillPreviewRows(data);

  return {
    totals: {
      totalEmployees: data.employees.length,
      employeesWithUserId: data.employees.filter((employee) => Boolean(employee.userId)).length,
      employeesWithoutUserId: data.employees.filter((employee) => !employee.userId).length,
      totalUsers: data.users.length,
      usersWithoutEmployees: data.users.filter((user) => {
        const linkedEmployeeIds = data.userToEmployeeIndex.get(user.id) ?? [];
        return linkedEmployeeIds.length === 0;
      }).length,
      totalUserIdentities: data.userIdentities.length,
      identitiesWithoutLinkedUsers: 0,
      identitiesWithoutLinkedUsersReason:
        "UserIdentity.userId is required and foreign-keyed, so dangling identities are not expected under normal Prisma writes.",
    },
    risks,
    preview: {
      totalPreviewRows: previewRows.length,
      countsByAction: {
        createUserAndLink: previewRows.filter((row) => row.action === "CREATE_USER_AND_LINK").length,
        linkExistingUser: previewRows.filter((row) => row.action === "LINK_EXISTING_USER").length,
        skipInvalidEmail: previewRows.filter((row) => row.action === "SKIP_INVALID_EMAIL").length,
        skipAmbiguousUserEmail: previewRows.filter((row) => row.action === "SKIP_AMBIGUOUS_USER_EMAIL").length,
        skipUserLinkedElsewhere: previewRows.filter((row) => row.action === "SKIP_USER_LINKED_ELSEWHERE").length,
      },
      rows: previewRows,
    },
  };
}

export async function getUnifiedIdentityOrganizationReadinessSummary() {
  const data = await getIdentityLinkageBaseData();
  const risks = buildCoverageRisks(data);

  let employeesMissingUserLinkage = 0;
  let employeesMissingOrganization = 0;
  let linkedUsersMissingOrganizationMembership = 0;
  let inactiveMemberships = 0;
  let usersWithMembershipInDifferentOrganization = 0;
  let linkedUsersWithoutIdentities = 0;

  for (const employee of data.employees) {
    if (!employee.userId) {
      employeesMissingUserLinkage += 1;
    }

    if (!employee.organizationId) {
      employeesMissingOrganization += 1;
    }

    if (!employee.userId) {
      continue;
    }

    const identities = data.userIdentityIndex.get(employee.userId) ?? [];

    if (identities.length === 0) {
      linkedUsersWithoutIdentities += 1;
    }

    if (!employee.organizationId) {
      continue;
    }

    const memberships = data.membershipByUserIndex.get(employee.userId) ?? [];
    const matchingMembership = memberships.find(
      (membership) => membership.organizationId === employee.organizationId
    );

    if (!matchingMembership) {
      linkedUsersMissingOrganizationMembership += 1;

      if (memberships.length > 0) {
        usersWithMembershipInDifferentOrganization += 1;
      }

      continue;
    }

    if (matchingMembership.status !== "ACTIVE") {
      inactiveMemberships += 1;
    }
  }

  const employeeEmailDuplicateRisks = risks.filter(
    (risk) => risk.type === "EMPLOYEE_NORMALIZED_EMAIL_DUPLICATE"
  ).length;
  const userEmailDuplicateRisks = risks.filter(
    (risk) => risk.type === "USER_NORMALIZED_EMAIL_DUPLICATE"
  ).length;
  const employeeUserEmailMismatchRisks = risks.filter(
    (risk) => risk.type === "EMPLOYEE_USER_EMAIL_MISMATCH"
  ).length;
  const userLinkedToMultipleEmployeesRisks = risks.filter(
    (risk) => risk.type === "USER_LINKED_TO_MULTIPLE_EMPLOYEES"
  ).length;
  const duplicateOrAmbiguousEmailRisks =
    employeeEmailDuplicateRisks +
    userEmailDuplicateRisks +
    employeeUserEmailMismatchRisks +
    userLinkedToMultipleEmployeesRisks;
  const usersWithoutIdentities = data.users.filter((user) => {
    const identities = data.userIdentityIndex.get(user.id) ?? [];
    return identities.length === 0;
  }).length;

  const blockingIssueCount =
    employeesMissingUserLinkage +
    employeesMissingOrganization +
    linkedUsersMissingOrganizationMembership +
    duplicateOrAmbiguousEmailRisks;
  const warningIssueCount =
    usersWithoutIdentities +
    inactiveMemberships +
    usersWithMembershipInDifferentOrganization;
  const overallStatus: UnifiedReadinessStatus =
    blockingIssueCount > 0
      ? "NOT_READY"
      : warningIssueCount > 0
        ? "NEEDS_REVIEW"
        : "READY";

  return {
    overallStatus,
    totals: {
      totalEmployees: data.employees.length,
      totalUsers: data.users.length,
      totalOrganizations: data.organizations.length,
      totalMemberships: data.organizationMemberships.length,
      totalUserIdentities: data.userIdentities.length,
    },
    readiness: {
      employeesMissingUserLinkage,
      employeesMissingOrganization,
      linkedUsersMissingOrganizationMembership,
      linkedUsersWithoutIdentities,
      usersWithoutIdentities,
      duplicateOrAmbiguousEmailRisks,
      inactiveMemberships,
      usersWithMembershipInDifferentOrganization,
    },
    riskBreakdown: {
      employeeEmailDuplicateRisks,
      userEmailDuplicateRisks,
      employeeUserEmailMismatchRisks,
      userLinkedToMultipleEmployeesRisks,
    },
    counts: {
      blockingIssueCount,
      warningIssueCount,
    },
    references: {
      identityLinkagePreviewPath: "/api/admin/auth/identity-linkage",
      organizationMembershipPreviewPath:
        "/api/admin/auth/organization-memberships",
      remediationPlaybookDoc: "docs/operator-identity-remediation-playbook.md",
      identityCoverageDoc: "docs/identity-linkage-coverage-and-backfill.md",
      organizationMembershipDoc: "docs/organization-membership-backfill.md",
    },
  };
}

async function writeBackfillAuditLog(input: {
  actorId: string;
  action: string;
  payload: Record<string, unknown>;
}) {
  await writeAuditLog(prisma, {
    userId: input.actorId,
    action: input.action,
    entityType: "AuthIdentityLinkage",
    entityId: "backfill",
    newValue: input.payload,
  });
}

export async function backfillIdentityLinkage(input: {
  actorId: string;
  apply: boolean;
}) {
  const data = await getIdentityLinkageBaseData();
  const previewRows = buildBackfillPreviewRows(data);
  const results: BackfillResultRow[] = [];

  for (const row of previewRows) {
    if (!input.apply) {
      results.push({
        ...row,
        applied: false,
        createdUserId: null,
        linkedUserId: null,
      });
      continue;
    }

    if (
      row.action !== "CREATE_USER_AND_LINK" &&
      row.action !== "LINK_EXISTING_USER"
    ) {
      results.push({
        ...row,
        applied: false,
        createdUserId: null,
        linkedUserId: null,
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
            firstName: true,
            lastName: true,
            userId: true,
          },
        });

        if (!employee) {
          return {
            applied: false,
            reason: "employee_not_found",
            createdUserId: null as string | null,
            linkedUserId: null as string | null,
          };
        }

        if (employee.userId) {
          return {
            applied: false,
            reason: "employee_already_linked",
            createdUserId: null as string | null,
            linkedUserId: employee.userId,
          };
        }

        const normalizedEmail = normalizeEmail(employee.email);

        if (!normalizedEmail) {
          return {
            applied: false,
            reason: "invalid_or_blank_email",
            createdUserId: null as string | null,
            linkedUserId: null as string | null,
          };
        }

        const matchingUsers = await tx.user.findMany({
          where: {
            email: {
              equals: normalizedEmail,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            email: true,
            employees: {
              select: {
                id: true,
              },
            },
          },
        });

        if (matchingUsers.length > 1) {
          return {
            applied: false,
            reason: "multiple_users_share_normalized_email",
            createdUserId: null as string | null,
            linkedUserId: null as string | null,
          };
        }

        let user = matchingUsers[0] ?? null;
        let createdUserId: string | null = null;

        if (!user) {
          user = await tx.user.create({
            data: {
              email: normalizedEmail,
              displayName:
                `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
                null,
            },
            select: {
              id: true,
              email: true,
              employees: {
                select: {
                  id: true,
                },
              },
            },
          });
          createdUserId = user.id;
        }

        if (user.employees.some((linkedEmployee) => linkedEmployee.id !== employee.id)) {
          return {
            applied: false,
            reason: "user_already_linked_to_other_employee",
            createdUserId,
            linkedUserId: null as string | null,
          };
        }

        await tx.employee.update({
          where: { id: employee.id },
          data: {
            userId: user.id,
          },
        });

        return {
          applied: true,
          reason: null,
          createdUserId,
          linkedUserId: user.id,
        };
      });

      results.push({
        ...row,
        action: appliedResult.applied ? row.action : row.action,
        reason: appliedResult.reason ?? row.reason,
        applied: appliedResult.applied,
        createdUserId: appliedResult.createdUserId,
        linkedUserId: appliedResult.linkedUserId,
      });
    } catch (error) {
      results.push({
        ...row,
        reason: error instanceof Error ? error.message : "unknown_backfill_error",
        applied: false,
        createdUserId: null,
        linkedUserId: null,
      });
    }
  }

  const summary = {
    apply: input.apply,
    totalRows: results.length,
    appliedRows: results.filter((row) => row.applied).length,
    createdUsers: results.filter((row) => Boolean(row.createdUserId)).length,
    linkedEmployees: results.filter((row) => row.applied && Boolean(row.linkedUserId)).length,
    skippedRows: results.filter((row) => !row.applied).length,
    conflictRows: results.filter((row) =>
      row.reason?.includes("multiple_users") ||
      row.reason?.includes("linked_to_other_employee")
    ).length,
  };

  await writeBackfillAuditLog({
    actorId: input.actorId,
    action: input.apply
      ? "AUTH_IDENTITY_LINKAGE_BACKFILL_APPLY"
      : "AUTH_IDENTITY_LINKAGE_BACKFILL_PREVIEW",
    payload: {
      summary,
      rows: results.filter((row) => !row.applied || row.createdUserId || row.linkedUserId),
    },
  });

  for (const row of results) {
    if (!row.applied && row.reason) {
      console.warn(
        JSON.stringify({
          eventType: "AUTH_IDENTITY_LINKAGE_BACKFILL_SKIPPED",
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
