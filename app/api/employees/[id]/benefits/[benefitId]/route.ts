import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/db";
import { writeAuditLog } from "../../../../../../lib/server/audit/write-audit-log";
import {
  isAuthorizationError,
  requireActor,
} from "../../../../../../lib/server/authorization";
import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import {
  canActorManageEmployeeBenefits,
  parseEmployeeBenefitElectionInput,
  serializeEmployeeBenefitElection,
} from "../../../../../../lib/server/employees/benefits";

function forbiddenManageResponse() {
  return NextResponse.json(
    { error: "You do not have permission to manage employee benefits." },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; benefitId: string }> }
) {
  try {
    const actor = await requireActor();
    const { id, benefitId } = await params;

    if (!canActorManageEmployeeBenefits(actor)) {
      return forbiddenManageResponse();
    }

    const existing = await prisma.employeeBenefitElection.findUnique({
      where: { id: benefitId },
    });

    if (!existing || existing.employeeId !== id) {
      return NextResponse.json(
        { error: "Benefit election not found." },
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

    const updated = await prisma.$transaction(async (tx) => {
      const election = await tx.employeeBenefitElection.update({
        where: { id: benefitId },
        data: parsed,
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_BENEFIT_ELECTION_UPDATE",
        entityType: "EmployeeBenefitElection",
        entityId: election.id,
        oldValue: serializeEmployeeBenefitElection(existing),
        newValue: serializeEmployeeBenefitElection(election),
      });

      return election;
    });

    return NextResponse.json(
      {
        success: true,
        election: serializeEmployeeBenefitElection(updated),
      },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    console.error("Benefit election update failed:", error);

    return NextResponse.json(
      { error: "Failed to update benefit election." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; benefitId: string }> }
) {
  try {
    const actor = await requireActor();
    const { id, benefitId } = await params;

    if (!canActorManageEmployeeBenefits(actor)) {
      return forbiddenManageResponse();
    }

    const existing = await prisma.employeeBenefitElection.findUnique({
      where: { id: benefitId },
    });

    if (!existing || existing.employeeId !== id) {
      return NextResponse.json(
        { error: "Benefit election not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeBenefitElection.delete({
        where: { id: benefitId },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_BENEFIT_ELECTION_DELETE",
        entityType: "EmployeeBenefitElection",
        entityId: existing.id,
        oldValue: serializeEmployeeBenefitElection(existing),
      });
    });

    return NextResponse.json(
      { success: true },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    console.error("Benefit election delete failed:", error);

    return NextResponse.json(
      { error: "Failed to delete benefit election." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
