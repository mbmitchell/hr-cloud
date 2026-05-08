import { prisma } from "../../db";
import type { AuthorizationActor } from "../authorization";
import {
  assertCanManageDocumentAcknowledgements,
  assertCanViewEmployeeDocumentAssignments,
} from "./access";
import type {
  AssignableEmployeeOption,
  AssignableDocumentListItem,
  EmployeeDocumentAcknowledgementSummary,
  EmployeeDocumentAssignmentListItem,
} from "./types";

export async function listAssignableDocumentsForAdmin(
  actor: AuthorizationActor
): Promise<AssignableDocumentListItem[]> {
  assertCanManageDocumentAcknowledgements(actor);

  const documents = await prisma.assignableDocument.findMany({
    include: {
      assignments: {
        select: {
          status: true,
          dueDate: true,
          viewedAt: true,
          acknowledgedAt: true,
        },
      },
      currentVersion: {
        select: {
          id: true,
          versionLabel: true,
          publishedAt: true,
        },
      },
      versions: {
        select: {
          id: true,
          versionLabel: true,
          publishedAt: true,
          employeeDocumentId: true,
          employeeDocument: {
            select: {
              originalFileName: true,
            },
          },
          assignments: {
            select: {
              id: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              notificationOutbox: {
                select: {
                  id: true,
                  createdAt: true,
                  lastError: true,
                  status: true,
                },
              },
              reminderOutboxEntries: {
                orderBy: [{ createdAt: "desc" }],
                take: 1,
                select: {
                  id: true,
                  reminderType: true,
                  status: true,
                  attemptCount: true,
                  createdAt: true,
                  sentAt: true,
                  lastError: true,
                },
              },
            },
            orderBy: {
              assignedAt: "desc",
            },
          },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const now = new Date();

  return documents.map((document) => {
    const totalAssignments = document.assignments.length;
    const pendingAssignments = document.assignments.filter(
      (assignment) => assignment.status === "PENDING"
    ).length;
    const acknowledgedAssignments = document.assignments.filter(
      (assignment) => assignment.status === "ACKNOWLEDGED"
    ).length;
    const viewedPendingAssignments = document.assignments.filter(
      (assignment) =>
        assignment.status === "PENDING" &&
        assignment.acknowledgedAt == null &&
        assignment.viewedAt != null
    ).length;
    const overdueAssignments = document.assignments.filter(
      (assignment) =>
        assignment.dueDate != null &&
        assignment.dueDate.getTime() < now.getTime() &&
        assignment.acknowledgedAt == null
    ).length;

    return {
      id: document.id,
      title: document.title,
      category: document.category,
      isActive: document.isActive,
      currentVersion: document.currentVersion,
      assignmentCounts: {
        total: totalAssignments,
        pending: pendingAssignments,
        viewedPending: viewedPendingAssignments,
        acknowledged: acknowledgedAssignments,
        overdue: overdueAssignments,
        completionPercentage:
          totalAssignments === 0
            ? 0
            : Math.round((acknowledgedAssignments / totalAssignments) * 100),
      },
      notificationCounts: {
        failed: document.versions.reduce(
          (count, version) =>
            count +
            version.assignments.filter(
              (assignment) => assignment.notificationOutbox?.status === "FAILED"
            ).length,
          0
        ),
      },
      recentFailedNotifications: document.versions
        .flatMap((version) =>
          version.assignments
            .filter(
              (assignment) =>
                assignment.notificationOutbox?.status === "FAILED"
            )
            .map((assignment) => ({
              id: assignment.notificationOutbox!.id,
              employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
              versionLabel: version.versionLabel,
              createdAt: assignment.notificationOutbox!.createdAt,
              lastError: assignment.notificationOutbox!.lastError,
            }))
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3),
      recentReminderHistory: document.versions
        .flatMap((version) =>
          version.assignments
            .filter((assignment) => assignment.reminderOutboxEntries.length > 0)
            .map((assignment) => ({
              id: assignment.reminderOutboxEntries[0]!.id,
              assignmentId: assignment.id,
              employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
              versionLabel: version.versionLabel,
              reminderType: assignment.reminderOutboxEntries[0]!.reminderType,
              status: assignment.reminderOutboxEntries[0]!.status,
              attemptCount: assignment.reminderOutboxEntries[0]!.attemptCount,
              createdAt: assignment.reminderOutboxEntries[0]!.createdAt,
              sentAt: assignment.reminderOutboxEntries[0]!.sentAt,
              lastError: assignment.reminderOutboxEntries[0]!.lastError,
            }))
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
      versions: document.versions.map((version) => ({
        id: version.id,
        versionLabel: version.versionLabel,
        publishedAt: version.publishedAt,
        employeeDocumentId: version.employeeDocumentId,
        originalFileName: version.employeeDocument.originalFileName,
      })),
    };
  });
}

export async function listAssignableEmployeeOptionsForAdmin(
  actor: AuthorizationActor
): Promise<AssignableEmployeeOption[]> {
  assertCanManageDocumentAcknowledgements(actor);

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      status: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return employees.map((employee) => ({
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    department: employee.department,
    status: employee.status,
  }));
}

export async function listEmployeeDocumentAssignmentsForActor(
  actor: AuthorizationActor,
  employeeId: string
): Promise<EmployeeDocumentAssignmentListItem[]> {
  assertCanViewEmployeeDocumentAssignments(actor, employeeId);

  const assignments = await prisma.employeeDocumentAssignment.findMany({
    where: { employeeId },
    select: {
      id: true,
      status: true,
      assignedAt: true,
      dueDate: true,
      viewedAt: true,
      acknowledgedAt: true,
      assignableDocument: {
        select: {
          id: true,
          title: true,
          category: true,
        },
      },
      assignableDocumentVersion: {
        select: {
          id: true,
          versionLabel: true,
          publishedAt: true,
          employeeDocumentId: true,
          employeeDocument: {
            select: {
              originalFileName: true,
            },
          },
        },
      },
      assignedByEmployee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status,
    assignedAt: assignment.assignedAt,
    dueDate: assignment.dueDate,
    viewedAt: assignment.viewedAt,
    acknowledgedAt: assignment.acknowledgedAt,
    document: assignment.assignableDocument,
    version: {
      id: assignment.assignableDocumentVersion.id,
      versionLabel: assignment.assignableDocumentVersion.versionLabel,
      publishedAt: assignment.assignableDocumentVersion.publishedAt,
      employeeDocumentId:
        assignment.assignableDocumentVersion.employeeDocumentId,
      originalFileName:
        assignment.assignableDocumentVersion.employeeDocument.originalFileName,
    },
    assignedBy: assignment.assignedByEmployee,
  }));
}

export async function getEmployeeDocumentAcknowledgementSummary(
  actor: AuthorizationActor,
  employeeId: string
): Promise<EmployeeDocumentAcknowledgementSummary> {
  assertCanViewEmployeeDocumentAssignments(actor, employeeId);

  const assignments = await prisma.employeeDocumentAssignment.findMany({
    where: { employeeId },
    select: {
      status: true,
      dueDate: true,
    },
  });

  const now = new Date();

  return {
    total: assignments.length,
    pending: assignments.filter((assignment) => assignment.status === "PENDING")
      .length,
    acknowledged: assignments.filter(
      (assignment) => assignment.status === "ACKNOWLEDGED"
    ).length,
    overdue: assignments.filter(
      (assignment) =>
        assignment.status === "PENDING" &&
        assignment.dueDate != null &&
        assignment.dueDate.getTime() < now.getTime()
    ).length,
  };
}

export async function getDocumentAssignmentForAcknowledgement(
  assignmentId: string
) {
  return prisma.employeeDocumentAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      employeeId: true,
      status: true,
      viewedAt: true,
      acknowledgedAt: true,
      assignableDocument: {
        select: {
          id: true,
          title: true,
          category: true,
        },
      },
      assignableDocumentVersion: {
        select: {
          id: true,
          versionLabel: true,
          employeeDocumentId: true,
          publishedAt: true,
          employeeDocument: {
            select: {
              mimeType: true,
              originalFileName: true,
            },
          },
        },
      },
    },
  });
}
