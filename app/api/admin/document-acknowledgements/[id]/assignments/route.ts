import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/db";
import { resolveAssignmentTargetEmployeeIds } from "../../../../../../lib/server/document-acknowledgements/assignment-targets";
import { assignDocumentVersionToEmployees } from "../../../../../../lib/server/document-acknowledgements/assign";
import {
  assertCanManageDocumentAcknowledgements,
  requireDocumentAcknowledgementActor,
} from "../../../../../../lib/server/document-acknowledgements/access";
import { isAuthorizationError } from "../../../../../../lib/server/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);
    const { id } = await params;
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const employeeIds = Array.isArray(body.employeeIds)
      ? body.employeeIds
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];
    const targetMode = String(body.targetMode || "SINGLE_EMPLOYEE").trim();
    const department = String(body.department || "").trim();
    const explicitVersionId = String(body.assignableDocumentVersionId || "").trim();
    const dueDateValue = String(body.dueDate || "").trim();

    const document = await prisma.assignableDocument.findUnique({
      where: { id },
      select: {
        id: true,
        currentVersionId: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Assignable document not found." },
        { status: 404 }
      );
    }

    const assignableDocumentVersionId =
      explicitVersionId || document.currentVersionId || "";

    if (!assignableDocumentVersionId) {
      return NextResponse.json(
        { error: "A published document version is required before assignment." },
        { status: 400 }
      );
    }

    let dueDate: Date | null = null;
    if (dueDateValue) {
      dueDate = new Date(dueDateValue);
      if (Number.isNaN(dueDate.getTime())) {
        return NextResponse.json(
          { error: "Due date is invalid." },
          { status: 400 }
        );
      }
    }

    const resolvedEmployeeIds = await resolveAssignmentTargetEmployeeIds(actor, {
      targetMode,
      employeeId,
      employeeIds,
      department,
    });

    if (resolvedEmployeeIds.length === 0) {
      return NextResponse.json(
        { error: "No employees matched the selected assignment target." },
        { status: 400 }
      );
    }

    const existingAssignments = await prisma.employeeDocumentAssignment.findMany({
      where: {
        assignableDocumentVersionId,
        employeeId: {
          in: resolvedEmployeeIds,
        },
      },
      select: {
        employeeId: true,
      },
    });

    const existingEmployeeIds = new Set(
      existingAssignments.map((assignment) => assignment.employeeId)
    );
    const employeeIdsToCreate = resolvedEmployeeIds.filter(
      (resolvedEmployeeId) => !existingEmployeeIds.has(resolvedEmployeeId)
    );

    const assignmentResult =
      employeeIdsToCreate.length > 0
        ? await assignDocumentVersionToEmployees({
            actorId: actor.id,
            employeeIds: employeeIdsToCreate,
            assignableDocumentVersionId,
            dueDate,
          })
        : {
            targetEmployeeIds: [] as string[],
            assignments: [] as Array<{
              id: string;
              employeeId: string;
              assignableDocumentId: string;
              assignableDocumentVersionId: string;
              assignmentSourceType: string;
              sourceEmployeeOnboardingTaskRequirementId: string | null;
              status: string;
              assignedAt: Date;
              dueDate: Date | null;
            }>,
          };

    return NextResponse.json({
      assignment:
        resolvedEmployeeIds.length === 1 &&
        assignmentResult.assignments.length === 1
          ? assignmentResult.assignments[0]
          : null,
      assignments: assignmentResult.assignments,
      targetEmployeeIds: resolvedEmployeeIds,
      summary: {
        attempted: resolvedEmployeeIds.length,
        created: assignmentResult.assignments.length,
        skipped: existingEmployeeIds.size,
      },
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      if (
        error.message === "At least one employee is required." ||
        error.message === "Assignment target mode is invalid." ||
        error.message === "No employees matched the selected assignment target." ||
        error.message === "Employee not found." ||
        error.message === "Assignable document version not found."
      ) {
        return NextResponse.json(
          { error: error.message },
          {
            status:
              error.message === "At least one employee is required." ||
              error.message === "Assignment target mode is invalid." ||
              error.message === "No employees matched the selected assignment target."
                ? 400
                : 404,
          }
        );
      }

      if (
        error.message ===
        "An active assignment already exists for this employee and document version."
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message === "Assignment actor is invalid.") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Failed to assign document." },
      { status: 500 }
    );
  }
}
