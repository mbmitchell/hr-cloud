import { prisma } from "../../../../lib/db";
import { projectPtoBalance } from "../../../../lib/pto/accrual";
import { getPolicySettings } from "../../../../lib/policy/settings";
import { NextResponse } from "next/server";
import {
  assertCanViewEmployee,
  isAuthorizationError,
  requireActor,
} from "../../../../lib/server/authorization";
import { withPrivateNoStoreHeaders } from "../../../../lib/server/http/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestStartDateParam = searchParams.get("requestStartDate");

    const employeeExists = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employeeExists) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    await assertCanViewEmployee(actor.id, id);

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        ledger: {
          orderBy: {
            effectiveDate: "desc",
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    const policy = await getPolicySettings();

    const ptoLedger = employee.ledger.filter((entry) => entry.bucket === "PTO");
    const compLedger = employee.ledger.filter((entry) => entry.bucket === "COMP");

    const currentPtoBalance = ptoLedger[0]?.balance ?? 0;
    const currentCompBalance = compLedger[0]?.balance ?? 0;

    let ptoProjection = null;

    if (requestStartDateParam) {
      const requestStartDate = new Date(requestStartDateParam);

      if (!Number.isNaN(requestStartDate.getTime())) {
        ptoProjection = projectPtoBalance({
          currentBalance: currentPtoBalance,
          hireDate: employee.hireDate,
          requestStartDate,
          monthlyAccrualOverride: employee.monthlyAccrualOverride,
          policy,
        });
      }
    }

    return NextResponse.json(
      {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        currentPtoBalance,
        currentCompBalance,
        monthlyAccrualOverride: employee.monthlyAccrualOverride,
        accrualOverrideReason: employee.accrualOverrideReason,
        ptoProjection,
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

    return NextResponse.json(
      { error: "Failed to load employee balances." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
