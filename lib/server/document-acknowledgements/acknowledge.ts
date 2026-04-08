import { prisma } from "../../db";
import {
  assertCanAcknowledgeDocumentAssignment,
  requireDocumentAcknowledgementActor,
} from "./access";

export async function acknowledgeDocumentAssignment(assignmentId: string) {
  const actor = await requireDocumentAcknowledgementActor();

  const assignment = await prisma.employeeDocumentAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      employeeId: true,
      status: true,
      viewedAt: true,
      acknowledgedAt: true,
    },
  });

  if (!assignment) {
    throw new Error("Document assignment not found.");
  }

  assertCanAcknowledgeDocumentAssignment(actor, assignment.employeeId);

  if (assignment.status === "ACKNOWLEDGED" || assignment.acknowledgedAt) {
    throw new Error("Document assignment has already been acknowledged.");
  }

  if (assignment.status === "CANCELLED") {
    throw new Error("Cancelled document assignments cannot be acknowledged.");
  }

  if (!assignment.viewedAt) {
    throw new Error("Please review the document before acknowledging.");
  }

  return prisma.employeeDocumentAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
    },
    select: {
      id: true,
      employeeId: true,
      status: true,
      assignedAt: true,
      dueDate: true,
      viewedAt: true,
      acknowledgedAt: true,
    },
  });
}

export async function markDocumentAssignmentViewed(assignmentId: string) {
  const actor = await requireDocumentAcknowledgementActor();

  const assignment = await prisma.employeeDocumentAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      employeeId: true,
      status: true,
      viewedAt: true,
    },
  });

  if (!assignment) {
    throw new Error("Document assignment not found.");
  }

  assertCanAcknowledgeDocumentAssignment(actor, assignment.employeeId);

  if (assignment.status === "CANCELLED") {
    throw new Error("Cancelled document assignments cannot be viewed.");
  }

  if (assignment.viewedAt) {
    return assignment;
  }

  return prisma.employeeDocumentAssignment.update({
    where: { id: assignment.id },
    data: {
      viewedAt: new Date(),
    },
    select: {
      id: true,
      employeeId: true,
      status: true,
      assignedAt: true,
      dueDate: true,
      viewedAt: true,
      acknowledgedAt: true,
    },
  });
}
