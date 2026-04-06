import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles } from "../../lib/auth/permissions";
import { canCurrentUserAccessAdjustmentsPage } from "../../lib/auth/access";

type NavItem = {
  href: string;
  label: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function SidebarSection({ title, items }: NavSection) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-slate-100 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

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
  const canSeeAdjustments = user
    ? await canCurrentUserAccessAdjustmentsPage()
    : false;
  const canSeeAudit = isSiteAdmin || isHrAdmin || isAuditor;

  const canSeePolicy = isSiteAdmin || isHrAdmin;
  const canAddEmployees = isSiteAdmin || isHrAdmin;
  const canSeeAuthDiagnostics = isSiteAdmin || isHrAdmin;

  const sections: NavSection[] = [
    {
      title: "Home",
      items: [
        { href: "/", label: "Dashboard" },
      ],
    },
    {
      title: "My Time",
      items: [
        { href: "/pto/request", label: "Request Time Off" },
        { href: "/pto/requests", label: "My Requests" },
        { href: "/calendar", label: "PTO Calendar" },
      ],
    },
    {
      title: "Team",
      items: [
        ...(canSeeApprovals
          ? [{ href: "/pto/approvals", label: "Approval Queue" }]
          : []),
        ...(canSeeApprovals
          ? [
              {
                href: "/dashboard/approvals",
                label: "Approvals",
              },
            ]
          : []),
      ],
    },
    {
      title: "People",
      items: [
        { href: "/employees", label: "Employees" },
        ...(canAddEmployees
          ? [{ href: "/admin/employees/new", label: "Add Employee" }]
          : []),
      ],
    },
    {
      title: "Administration",
      items: [
        ...(canSeeAdjustments
          ? [{ href: "/admin/adjustments", label: "PTO Adjustments" }]
          : []),
        ...(canSeePolicy
          ? [{ href: "/admin/policy", label: "Settings" }]
          : []),
        ...(canSeeAdjustments
          ? [{ href: "/admin/accrual-override", label: "Accrual Settings" }]
          : []),
        ...(canSeeCompensation
          ? [{ href: "/admin/compensation", label: "Compensation" }]
          : []),
        ...(isSiteAdmin
          ? [{ href: "/admin/run-accruals", label: "Monthly Accrual" }]
          : []),
        ...(isSiteAdmin
          ? [{ href: "/admin/run-rollover", label: "Year-End Rollover" }]
          : []),
        ...(canSeeAuthDiagnostics
          ? [{ href: "/admin/auth", label: "Auth Diagnostics" }]
          : []),
      ],
    },
    {
      title: "Reports",
      items: [
        ...(canSeeReports ? [{ href: "/reports", label: "Reports" }] : []),
        ...(canSeeAudit ? [{ href: "/admin/audit", label: "Audit Log" }] : []),
      ],
    },
  ];

  return (
    <aside className="min-h-screen w-64 bg-slate-900 p-6 text-white">
      <div className="mb-6 border-b border-slate-800 pb-4">
        <div className="text-lg font-semibold">MFN HR</div>
        <div className="mt-1 text-xs text-slate-400">
          Managed Financial Networks
        </div>
      </div>

      <nav className="space-y-6">
        {sections.map((section) => (
          <SidebarSection
            key={section.title}
            title={section.title}
            items={section.items}
          />
        ))}
      </nav>
    </aside>
  );
}
