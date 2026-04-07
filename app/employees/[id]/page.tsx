import { getCurrentUser } from "../../../lib/auth/current-user";
import { getEmployeeRoles, isManagerOf } from "../../../lib/auth/permissions";
import { getEmployeeProfilePageData } from "../../../lib/server/employees/employee-queries";
import {
  getActiveOnboardingTemplates,
  getEmployeeOnboardingSummary,
} from "../../../lib/server/onboarding";
import {
  getActiveOffboardingTemplates,
  getEmployeeOffboardingSummary,
} from "../../../lib/server/offboarding/offboarding-queries";
import Link from "next/link";
import EmployeeDocumentsPanel from "../../../components/employees/employee-documents-panel";
import EmployeeEditForm from "./EmployeeEditForm";
import EmployeeOffboardingPanel from "./EmployeeOffboardingPanel";
import EmployeeOnboardingPanel from "./EmployeeOnboardingPanel";
import EmployeeProfileSection from "./EmployeeProfileSection";
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
  const canViewDocuments = isSelf || isAdmin;

  if (!canViewProfile) {
    return (
      <div className="text-red-600">
        You do not have permission to view this employee profile.
      </div>
    );
  }

  const { employee, managerOptions, allRoles, statusHistoryEntries } = await getEmployeeProfilePageData({
    employeeId: id,
    includeAdminOptions: isAdmin,
  });

  if (!employee) {
    return <div className="text-red-600">Employee not found.</div>;
  }

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
  const directReports = employee.directReports;
  const [
    onboardingSummary,
    activeOnboardingTemplates,
    offboardingSummary,
    activeOffboardingTemplates,
  ] = await Promise.all([
    getEmployeeOnboardingSummary(employee.id),
    isAdmin ? getActiveOnboardingTemplates() : Promise.resolve([]),
    isAdmin ? getEmployeeOffboardingSummary(employee.id) : Promise.resolve(null),
    isAdmin ? getActiveOffboardingTemplates() : Promise.resolve([]),
  ]);

  const roleCodes = employee.roleAssignments.map((assignment) => assignment.role.code);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 sm:w-auto"
        >
          Back to Employees
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">PTO Balance</div>
          <div className="text-3xl font-semibold mt-2">
            {currentPtoBalance.toFixed(2)}
          </div>
          <div className="text-sm text-slate-500 mt-1">hours</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">COMP Balance</div>
          <div className="text-3xl font-semibold mt-2">
            {currentCompBalance.toFixed(2)}
          </div>
          <div className="text-sm text-slate-500 mt-1">hours</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
          <div className="text-sm text-slate-500">Monthly Accrual Rate</div>
          <div className="text-3xl font-semibold mt-2">
            {monthlyAccrualRate.toFixed(2)}
          </div>
          <div className="text-sm text-slate-500 mt-1">hours / month</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow sm:p-5">
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

      <EmployeeOnboardingPanel
        employeeId={employee.id}
        onboarding={
          onboardingSummary
            ? {
                id: onboardingSummary.id,
                status: onboardingSummary.status,
                templateName: onboardingSummary.template?.name ?? null,
                totalCount: onboardingSummary.summary.totalCount,
                completedCount: onboardingSummary.summary.completedCount,
                pendingCount: onboardingSummary.summary.pendingCount,
                nextDueDate: onboardingSummary.summary.nextDueDate
                  ? formatDate(onboardingSummary.summary.nextDueDate)
                  : null,
              }
            : null
        }
        activeTemplates={activeOnboardingTemplates}
        canCreate={isAdmin}
      />

      {isAdmin && (
        <EmployeeOffboardingPanel
          employeeId={employee.id}
          offboarding={
            offboardingSummary
              ? {
                  id: offboardingSummary.id,
                  status: offboardingSummary.status,
                  separationType: offboardingSummary.separationType,
                  terminationDate: formatDate(offboardingSummary.terminationDate),
                  completionPercentage:
                    offboardingSummary.progress.completionPercentage,
                  totalTasks: offboardingSummary.progress.totalTasks,
                  completedTasks: offboardingSummary.progress.completedTasks,
                }
              : null
          }
          activeTemplates={activeOffboardingTemplates}
          canCreate={isAdmin}
        />
      )}

      {canViewDocuments && (
        <EmployeeDocumentsPanel
          employeeId={employee.id}
          canUpload={isAdmin}
          canManage={isAdmin}
        />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <EmployeeProfileSection title="Employment">
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
          </div>
        </EmployeeProfileSection>

        <EmployeeProfileSection title="Reporting">
          <div className="space-y-2 text-sm">
            <div>
              <b>Manager:</b>{" "}
              {employee.manager
                ? `${employee.manager.firstName} ${employee.manager.lastName}`
                : "-"}
            </div>
            {directReports.length > 0 && (
              <div className="pt-2">
                <div className="font-semibold text-slate-900">Direct Reports</div>
                <div className="mt-2 space-y-2">
                  {directReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/employees/${report.id}`}
                      className="block rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="font-medium text-slate-900 hover:text-blue-600">
                        {report.firstName} {report.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {report.title ?? "No title"}
                        {report.department ? ` • ${report.department}` : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </EmployeeProfileSection>

        <EmployeeProfileSection title="Organization">
          <div className="space-y-2 text-sm">
            <div>
              <b>Roles:</b> {roleCodes.length ? roleCodes.join(", ") : "-"}
            </div>
          </div>
        </EmployeeProfileSection>

        <EmployeeProfileSection title="Accrual Settings" className="xl:col-span-3">
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
        </EmployeeProfileSection>
      </div>

      <EmployeeProfileSection title="Status History">
        {statusHistoryEntries.length === 0 ? (
          <div className="text-sm text-slate-500">
            No status history found.
          </div>
        ) : (
          <div className="space-y-3">
            {statusHistoryEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-200 px-4 py-3"
              >
                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {entry.previousStatus} to {entry.newStatus}
                    </div>
                    <div className="mt-1 text-slate-500">
                      Changed by {entry.changedByName}
                    </div>
                  </div>
                  <div className="text-slate-500">
                    {formatDate(entry.changedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </EmployeeProfileSection>

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

      <EmployeeProfileSection title="Recent Ledger Activity" className="overflow-hidden px-0 pb-0 pt-5 sm:px-0 sm:pb-0 sm:pt-6">
        <div className="hidden md:block">
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

        <div className="space-y-4 md:hidden">
          {visibleLedger.length === 0 ? (
            <div className="text-sm text-slate-500">
              No ledger activity found.
            </div>
          ) : (
            visibleLedger.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {entry.bucket} • {entry.type}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(entry.effectiveDate)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Hours</div>
                    <div className="font-medium text-slate-900">
                      {entry.hours.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Balance</div>
                    <div className="font-medium text-slate-900">
                      {entry.balance.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Notes</div>
                  <div className="break-words text-slate-900">{entry.notes ?? "-"}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </EmployeeProfileSection>

      <EmployeeProfileSection title="Recent Requests" className="overflow-hidden px-0 pb-0 pt-5 sm:px-0 sm:pb-0 sm:pt-6">
        <div className="hidden md:block">
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

        <div className="space-y-4 md:hidden">
          {visibleRequests.length === 0 ? (
            <div className="text-sm text-slate-500">
              No requests found.
            </div>
          ) : (
            visibleRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {request.leaveType}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {request.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {formatDate(request.startDate)} - {formatDate(request.endDate)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Created</div>
                    <div className="font-medium text-slate-900">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Hours</div>
                    <div className="font-medium text-slate-900">
                      {request.hours.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Request Notes</div>
                  <div className="break-words text-slate-900">{request.notes ?? "-"}</div>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-slate-500">Decision Comment</div>
                  <div className="break-words text-slate-900">
                    {request.approvalComment ?? "-"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </EmployeeProfileSection>
    </div>
  );
}
