import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import {
  isAuthorizationError,
  requireActor,
} from "../../../../../lib/server/authorization";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  canActorManageEmployeeBenefits,
  canActorViewEmployeeBenefits,
  parseEmployeeBenefitElectionInput,
  serializeEmployeeBenefitElection,
} from "../../../../../lib/server/employees/benefits";

function forbiddenViewResponse() {
  return NextResponse.json(
    { error: "You do not have permission to view employee benefits." },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

function forbiddenManageResponse() {
  return NextResponse.json(
    { error: "You do not have permission to manage employee benefits." },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!canActorViewEmployeeBenefits(actor, id)) {
      return forbiddenViewResponse();
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    const elections = await prisma.employeeBenefitElection.findMany({
      where: { employeeId: id },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      { elections: elections.map(serializeEmployeeBenefitElection) },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to load employee benefits." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!canActorManageEmployeeBenefits(actor)) {
      return forbiddenManageResponse();
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    let parsed;

    try {
      parsed = parseEmployeeBenefitElectionInput(body);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid benefit election." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      const election = await tx.employeeBenefitElection.create({
        data: {
          employeeId: id,
          ...parsed,
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_BENEFIT_ELECTION_CREATE",
        entityType: "EmployeeBenefitElection",
        entityId: election.id,
        newValue: serializeEmployeeBenefitElection(election),
      });

      return election;
    });

    return NextResponse.json(
      {
        success: true,
        election: serializeEmployeeBenefitElection(saved),
      },
      withPrivateNoStoreHeaders({ status: 201 })
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    console.error("Benefit election create failed:", error);

    return NextResponse.json(
      { error: "Failed to save benefit election." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
