/**
 * PTO Request API Route
 *
 * Handles creation of employee leave requests.
 *
 * Responsibilities:
 * - Validate request payloads
 * - Derive the acting employee from the authenticated session
 * - Persist the request, request history, and audit record transactionally
 * - Trigger post-commit notification enqueue
 *
 * Security considerations:
 * - Only authenticated employees may create requests
 * - Employee identity must come from the session plus authorization rules,
 *   never directly from the client body
 */
import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";
import {
  assertCanCreateRequestFor,
  isAuthorizationError,
  requireActor,
} from "../../../lib/server/authorization";
import { writeAuditLog } from "../../../lib/server/audit/write-audit-log";
import { isLeaveType } from "../../../lib/pto/leave-types";
import { enqueuePtoNotifications } from "../../../lib/server/hr-notifications/pto";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = await request.json();

    const requestedEmployeeId = String(body.employeeId || actor.id).trim();
    const leaveType = String(body.leaveType || "").trim();
    const startDate = String(body.startDate || "").trim();
    const endDate = String(body.endDate || "").trim();
    const hours = Number(body.hours);
    const notes = body.notes ? String(body.notes).trim() : null;
    const employeeId = requestedEmployeeId || actor.id;

    if (!employeeId || !leaveType || !startDate || !endDate || !hours) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!isLeaveType(leaveType)) {
      return NextResponse.json(
        { error: "Leave type is invalid." },
        { status: 400 }
      );
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      Number.isNaN(parsedEndDate.getTime())
    ) {
      return NextResponse.json(
        { error: "Start date and end date must be valid dates." },
        { status: 400 }
      );
    }

    if (hours <= 0) {
      return NextResponse.json(
        { error: "Hours must be greater than zero." },
        { status: 400 }
      );
    }

    // SECURITY:
    // The target employee is validated against the authenticated actor here so
    // the client cannot submit requests on behalf of another employee unless
    // the server-side authorization policy explicitly allows it.
    await assertCanCreateRequestFor(actor.id, employeeId);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const requestRecord = await tx.pTORequest.create({
        data: {
          employeeId,
          leaveType,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          hours,
          status: "PENDING",
          notes,
        },
      });

      await tx.pTORequestAction.create({
        data: {
          requestId: requestRecord.id,
          action: "SUBMITTED",
          actionById: actor.id,
          comment: notes,
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "REQUEST_CREATED",
        entityType: "PTORequest",
        entityId: requestRecord.id,
        newValue: {
          employeeId: requestRecord.employeeId,
          leaveType: requestRecord.leaveType,
          startDate: requestRecord.startDate.toISOString(),
          endDate: requestRecord.endDate.toISOString(),
          hours: requestRecord.hours,
          status: requestRecord.status,
          notes: requestRecord.notes,
          submittedBy: actor.id,
        },
      });

      return requestRecord;
    });

    try {
      await enqueuePtoNotifications({
        eventType: "PTO_REQUEST_SUBMITTED",
        requestId: created.id,
        actorId: actor.id,
      });
    } catch (error) {
      console.error("Failed to enqueue PTO submitted notifications:", error);
    }

    return NextResponse.json(created);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Failed to create PTO request:", error);

    return NextResponse.json(
      { error: "Failed to create PTO request." },
      { status: 500 }
    );
  }
}
