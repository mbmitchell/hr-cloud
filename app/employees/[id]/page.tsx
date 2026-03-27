import { prisma } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { getEmployeeRoles, isManagerOf } from "../../../lib/auth/permissions";
import Link from "next/link";
import EmployeeEditForm from "./EmployeeEditForm";
import EmployeeRolePanel from "./EmployeeRolePanel";

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString();
}

function getMonthlyAccrualRateForDisplay(params: {
  hireDate: Date;
  monthlyAccrualOverride?: number | null;
  asOfDate?: Date;
}) {
  if (params.monthlyAccrualOverride != null) {
    return params.monthlyAccrualOverride;
  }

  const asOfDate = params.asOfDate ?? new Date();
  let years = asOfDate.getFullYear() - params.hireDate.getFullYear();

  if (
    asOfDate.getMonth() < params.hireDate.getMonth() ||
    (asOfDate.getMonth() === params.hireDate.getMonth() &&
      asOfDate.getDate() < params.hireDate.getDate())
  ) {
    years -= 1;
  }

  if (years <= 5) return 10.0;
  if (years <= 10) return 13.33;
  return 16.67;
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <div className="text-red-600">No current user found.</div>;
  }

  const currentUserRoles = await getEmployeeRoles(currentUser.id);
  const isAdmin =
    currentUserRoles.includes("SITE_ADMIN") ||
    currentUserRoles.includes("HR_ADMIN");
  const isExecutive = currentUserRoles.includes("EXECUTIVE_READONLY");
  const isAuditor = currentUserRoles.includes("AUDITOR");
  const isManager = currentUserRoles.includes("MANAGER");

  const isSelf = currentUser.id === id;
  const managesEmployee = isManager ? await isManagerOf(currentUser.id, id) : false;

  const canViewProfile =
    isSelf || isAdmin || isExecutive || isAuditor || managesEmployee;

  if (!canViewProfile) {
    return (
      <div className="text-red-600">
        You do not have permission to view this employee profile.
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      manager: true,
      ledger: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
      requests: {
        orderBy: [{ createdAt: "desc" }],
      },
      roleAssignments: {
        where: { isActive: true },
        include: { role: true },
      },
    },
  });

  if (!employee) {
    return <div className="text-red-600">Employee not found.</div>;
  }

  const managerOptions = isAdmin
    ? await prisma.employee.findMany({
        where: {
          id: { not: employee.id },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  const allRoles = isAdmin
    ? await prisma.role.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      })
    : [];

  const ptoLedger = employee.ledger.filter((entry) => entry.bucket === "PTO");
  const compLedger = employee.ledger.filter((entry) => entry.bucket === "COMP");

  const currentPtoBalance = ptoLedger[0]?.balance ?? 0;
  const currentCompBalance = compLedger[0]?.balance ?? 0;

  const monthlyAccrualRate = getMonthlyAccrualRateForDisplay({
    hireDate: employee.hireDate,
    monthlyAccrualOverride: employee.monthlyAccrualOverride,
  });

  const visibleRequests = employee.requests.slice(0, 10);
  const visibleLedger = employee.ledger.slice(0, 20);

  const roleCodes = employee.roleAssignments.map((assignment) => assignment.role.code);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {employee.firstName} {employee.lastName}
          </h2>
          <div className="text-sm text-slate-600 mt-1">
            {employee.title ?? "No title"} • {employee.department ?? "No department"}
          </div>
        </div>

        <Link
          href="/employees"
          className="border border-slate-300 px-3 py-2 rounded hover:bg-slate-50 text-sm"
        >
          Back to Employees
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded shadow p-5">
          <div className="text-sm text-slate-500">PTO Balance</div>
          <div className="text-3xl font-semibold mt-2">
            {currentPtoBalance.toFixed(2)}
          </div>
          <div className="text-sm text-slate-500 mt-1">hours</div>
        </div>

        <div className="bg-white rounded shadow p-5">
          <div className="text-sm text-slate-500">COMP Balance</div>
          <div className="text-3xl font-semibold mt-2">
            {currentCompBalance.toFixed(2)}
          </div>
          <div className="text-sm text-slate-500 mt-1">hours</div>
        </div>

        <div className="bg-white rounded shadow p-5">
          <div className="text-sm text-slate-500">Monthly Accrual Rate</div>
          <div className="text-3xl font-semibold mt-2">
            {monthlyAccrualRate.toFixed(2)}
          </div>
          <div className="text-sm text-slate-500 mt-1">hours / month</div>
        </div>

        <div className="bg-white rounded shadow p-5">
          <div className="text-sm text-slate-500">Manager</div>
          <div className="text-xl font-semibold mt-2">
            {employee.manager
              ? `${employee.manager.firstName} ${employee.manager.lastName}`
              : "None"}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Hire Date: {formatDate(employee.hireDate)}
          </div>
        </div>
      </div>

      {isAdmin && (
        <EmployeeEditForm
          employee={{
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            department: employee.department,
            title: employee.title,
            status: employee.status,
            hireDate: employee.hireDate.toISOString().split("T")[0],
            managerId: employee.managerId,
          }}
          managers={managerOptions}
        />
      )}

      {isAdmin && (
        <EmployeeRolePanel
          employeeId={employee.id}
          roles={allRoles.map((role) => ({
            id: role.id,
            code: role.code,
            name: role.name,
          }))}
          assignedRoleCodes={roleCodes}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Employee Summary</h3>

          <div className="space-y-2 text-sm">
            <div>
              <b>Email:</b> {employee.email}
            </div>
            <div>
              <b>Status:</b> {employee.status}
            </div>
            <div>
              <b>Department:</b> {employee.department ?? "-"}
            </div>
            <div>
              <b>Title:</b> {employee.title ?? "-"}
            </div>
            <div>
              <b>Hire Date:</b> {formatDate(employee.hireDate)}
            </div>
            <div>
              <b>Manager:</b>{" "}
              {employee.manager
                ? `${employee.manager.firstName} ${employee.manager.lastName}`
                : "-"}
            </div>
            <div>
              <b>Roles:</b> {roleCodes.length ? roleCodes.join(", ") : "-"}
            </div>
          </div>
        </div>

        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Accrual Settings</h3>

          <div className="space-y-2 text-sm">
            <div>
              <b>Standard Monthly Rate:</b> {monthlyAccrualRate.toFixed(2)} hours
            </div>
            <div>
              <b>Override:</b>{" "}
              {employee.monthlyAccrualOverride != null
                ? `${employee.monthlyAccrualOverride.toFixed(2)} hours/month`
                : "None"}
            </div>
            <div>
              <b>Override Reason:</b> {employee.accrualOverrideReason ?? "-"}
            </div>
            <div>
              <b>Rollover Cap:</b> 80.00 hours
            </div>
            <div>
              <b>PTO/SICK Bucket:</b> PTO
            </div>
            <div>
              <b>COMP Bucket:</b> COMP
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Recent Ledger Activity</h3>
        </div>

        <table className="w-full">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Bucket</th>
              <th className="p-3">Type</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleLedger.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="p-3">{formatDate(entry.effectiveDate)}</td>
                <td className="p-3">{entry.bucket}</td>
                <td className="p-3">{entry.type}</td>
                <td className="p-3">{entry.hours.toFixed(2)}</td>
                <td className="p-3">{entry.balance.toFixed(2)}</td>
                <td className="p-3">{entry.notes ?? "-"}</td>
              </tr>
            ))}
            {visibleLedger.length === 0 && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={6}>
                  No ledger activity found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Recent Requests</h3>
        </div>

        <table className="w-full">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Created</th>
              <th className="p-3">Type</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Status</th>
              <th className="p-3">Request Notes</th>
              <th className="p-3">Decision Comment</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((request) => (
              <tr key={request.id} className="border-t">
                <td className="p-3">{formatDate(request.createdAt)}</td>
                <td className="p-3">{request.leaveType}</td>
                <td className="p-3">
                  {formatDate(request.startDate)} - {formatDate(request.endDate)}
                </td>
                <td className="p-3">{request.hours.toFixed(2)}</td>
                <td className="p-3">{request.status}</td>
                <td className="p-3">{request.notes ?? "-"}</td>
                <td className="p-3">{request.approvalComment ?? "-"}</td>
              </tr>
            ))}
            {visibleRequests.length === 0 && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={7}>
                  No requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}