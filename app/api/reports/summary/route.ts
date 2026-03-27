import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { canCurrentUserViewReports } from "../../../../lib/auth/access";
import { calculatePtoLiability } from "../../../../lib/finance/liability";

type BalanceMap = Record<string, { PTO: number; COMP: number }>;

export async function GET() {
  try {
    const allowed = await canCurrentUserViewReports();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have access to financial reports." },
        { status: 403 }
      );
    }

    const employees = await prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const ledger = await prisma.pTOLedger.findMany({
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    });

    const pendingRequests = await prisma.pTORequest.findMany({
      where: { status: "PENDING" },
      include: { employee: true },
      orderBy: [{ createdAt: "desc" }],
    });

    const approvedUpcoming = await prisma.pTORequest.findMany({
      where: {
        status: "APPROVED",
        endDate: {
          gte: new Date(),
        },
      },
      include: { employee: true },
      orderBy: [{ startDate: "asc" }],
    });

    const latestBalances: BalanceMap = {};

    for (const entry of ledger) {
      if (!latestBalances[entry.employeeId]) {
        latestBalances[entry.employeeId] = { PTO: 0, COMP: 0 };
      }

      if (
        entry.bucket === "PTO" &&
        latestBalances[entry.employeeId].PTO === 0
      ) {
        latestBalances[entry.employeeId].PTO = entry.balance;
      }

      if (
        entry.bucket === "COMP" &&
        latestBalances[entry.employeeId].COMP === 0
      ) {
        latestBalances[entry.employeeId].COMP = entry.balance;
      }
    }

    const employeeBalances = employees.map((employee) => {
      const balances = latestBalances[employee.id] ?? { PTO: 0, COMP: 0 };

      const { effectiveHourlyRate, liability } = calculatePtoLiability({
        ptoHours: balances.PTO,
        payType: employee.payType,
        hourlyRate: employee.hourlyRate,
        annualSalary: employee.annualSalary,
        fte: employee.fte,
      });

      return {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        title: employee.title,
        status: employee.status,
        ptoBalance: balances.PTO,
        compBalance: balances.COMP,
        payType: employee.payType,
        effectiveHourlyRate,
        ptoLiability: liability,
      };
    });

    const totalPtoLiabilityHours = employeeBalances.reduce(
      (sum, employee) => sum + employee.ptoBalance,
      0
    );

    const totalPtoLiabilityDollars = employeeBalances.reduce(
      (sum, employee) => sum + employee.ptoLiability,
      0
    );

    return NextResponse.json({
      summary: {
        employeeCount: employees.length,
        pendingRequestCount: pendingRequests.length,
        upcomingApprovedCount: approvedUpcoming.length,
        totalPtoLiabilityHours,
        totalPtoLiabilityDollars,
      },
      employeeBalances,
      pendingRequests: pendingRequests.map((request) => ({
        id: request.id,
        employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
        department: request.employee.department,
        leaveType: request.leaveType,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        hours: request.hours,
        notes: request.notes ?? "",
        status: request.status,
      })),
      upcomingApproved: approvedUpcoming.map((request) => ({
        id: request.id,
        employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
        department: request.employee.department,
        leaveType: request.leaveType,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        hours: request.hours,
        notes: request.notes ?? "",
        status: request.status,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load report summary." },
      { status: 500 }
    );
  }
}