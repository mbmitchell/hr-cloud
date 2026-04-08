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
      acknowledgedAt: true,
    },
  });
}
