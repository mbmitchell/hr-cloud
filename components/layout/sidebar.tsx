import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles } from "../../lib/auth/permissions";

export default async function Sidebar() {
  const user = await getCurrentUser();

  let roles: string[] = [];

  if (user) {
    roles = await getEmployeeRoles(user.id);
  }

  const isSiteAdmin = roles.includes("SITE_ADMIN");
  const isHrAdmin = roles.includes("HR_ADMIN");
  const isAccounting = roles.includes("ACCOUNTING");
  const isManager = roles.includes("MANAGER");
  const isAuditor = roles.includes("AUDITOR");
  const isExecutive = roles.includes("EXECUTIVE_READONLY");

  const canSeeCompensation = isSiteAdmin || isHrAdmin || isAccounting;
  const canSeeReports =
    isSiteAdmin || isHrAdmin || isAccounting || isExecutive;
  const canSeeApprovals = isSiteAdmin || isHrAdmin || isManager;
  const canSeeAdjustments = isSiteAdmin || isHrAdmin;
  const canSeeAudit = isSiteAdmin || isHrAdmin || isAuditor;

  const canSeePolicy = isSiteAdmin || isHrAdmin;
  const canAddEmployees = isSiteAdmin || isHrAdmin;

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
      <div className="text-lg font-semibold mb-6">MFN HR</div>

      <nav className="space-y-3 text-sm">
        <Link href="/" className="block hover:text-slate-300">
          Dashboard
        </Link>

        <Link href="/employees" className="block hover:text-slate-300">
          Employees
        </Link>
{canAddEmployees && (
  <Link href="/admin/employees/new" className="block hover:text-slate-300">
    Add Employee
  </Link>
)}
        <Link href="/pto/request" className="block hover:text-slate-300">
          Request PTO
        </Link>

        <Link href="/pto/requests" className="block hover:text-slate-300">
          PTO History
        </Link>

        {canSeeApprovals && (
          <Link href="/pto/approvals" className="block hover:text-slate-300">
            Approvals
          </Link>
        )}

        {canSeeApprovals && (
          <Link
            href="/dashboard/approvals"
            className="block hover:text-slate-300"
          >
            Approval Dashboard
          </Link>
        )}

        <Link href="/calendar" className="block hover:text-slate-300">
          Calendar
        </Link>

        {canSeeReports && (
          <Link href="/reports" className="block hover:text-slate-300">
            Reports
          </Link>
        )}

        {canSeeAdjustments && (
          <Link
            href="/admin/adjustments"
            className="block hover:text-slate-300"
          >
            PTO Adjustments
          </Link>
        )}
{canSeePolicy && (
  <Link href="/admin/policy" className="block hover:text-slate-300">
    Policy Settings
  </Link>
)}
        {canSeeAdjustments && (
          <Link
            href="/admin/accrual-override"
            className="block hover:text-slate-300"
          >
            Accrual Overrides
          </Link>
        )}

        {canSeeCompensation && (
          <Link
            href="/admin/compensation"
            className="block hover:text-slate-300"
          >
            Compensation
          </Link>
        )}

        {isSiteAdmin && (
          <Link
            href="/admin/run-accruals"
            className="block hover:text-slate-300"
          >
            Run Monthly Accrual
          </Link>
        )}

        {isSiteAdmin && (
          <Link
            href="/admin/run-rollover"
            className="block hover:text-slate-300"
          >
            Run Year End Rollover
          </Link>
        )}

        {canSeeAudit && (
          <Link href="/admin/audit" className="block hover:text-slate-300">
            Audit Log
          </Link>
        )}
      </nav>
    </aside>
  );
}