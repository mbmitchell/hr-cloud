import { auth } from "../auth";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { getCurrentUser } from "../lib/auth/current-user";

export default async function DashboardPage() {

  // Auth.js session check
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Load employee identity
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Dashboard metrics
  const employeeCount = await prisma.employee.count({
    where: { status: "ACTIVE" },
  });

  const pendingRequests = await prisma.pTORequest.count({
    where: { status: "PENDING" },
  });

  const employeesOnLeaveToday = await prisma.pTORequest.count({
    where: {
      status: "APPROVED",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        HR Dashboard
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">Active Employees</div>
          <div className="text-3xl font-semibold mt-2">{employeeCount}</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">Pending Requests</div>
          <div className="text-3xl font-semibold mt-2">{pendingRequests}</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">Employees Out Today</div>
          <div className="text-3xl font-semibold mt-2">{employeesOnLeaveToday}</div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow sm:p-6">
        <h2 className="text-lg font-semibold mb-2">
          Welcome back
        </h2>

        <p className="text-sm text-slate-600">
          {currentUser.firstName} {currentUser.lastName}
        </p>
      </div>

    </div>
  );
}
