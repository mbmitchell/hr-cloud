"use client";

import { useEffect, useState } from "react";

type EmployeeMasterShadowWarning =
  | "TENANT_CONTEXT_ORGANIZATION_ID_MISSING"
  | "REPORT_EMPLOYEES_MISSING_ORGANIZATION"
  | "TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES";

type EmployeeMasterShadowResponse = {
  mode: "shadow_compare";
  shadowCompare: {
    tenantContextOrganizationId: string | null;
    counts: {
      currentReportEmployeeCount: number;
      tenantScopedReportEmployeeCount: number;
      missingOrganizationCount: number;
      excludedByTenantFilterCount: number;
    };
    excludedByTenantFilter: Array<{
      employeeId: string;
      employeeName: string;
      workEmail: string;
      status: string;
      department: string | null;
      managerName: string | null;
      organizationId: string | null;
    }>;
    warnings: EmployeeMasterShadowWarning[];
  };
};

const WARNING_GUIDANCE: Record<EmployeeMasterShadowWarning, string> = {
  TENANT_CONTEXT_ORGANIZATION_ID_MISSING:
    "The current admin does not yet resolve to an organization in TenantContext, so the scoped report comparison cannot be used as an enforcement-ready signal.",
  REPORT_EMPLOYEES_MISSING_ORGANIZATION:
    "Some employees in the current employee master report still have no organization assignment. Resolve those gaps before report scoping is considered.",
  TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES:
    "The shadow organization filter would exclude some employees from the current employee master report result. Review those exclusions before any scoped reporting rollout.",
};

function CountCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  );
}

function WarningBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-xs text-amber-700">
      {children}
    </span>
  );
}

export default function EmployeeMasterShadowResultsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EmployeeMasterShadowResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/auth/employee-master-shadow", {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | EmployeeMasterShadowResponse
          | { error?: string };
        const errorMessage =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load employee master report tenant shadow compare.";

        if (!response.ok) {
          throw new Error(errorMessage);
        }

        if (!cancelled) {
          setData(payload as EmployeeMasterShadowResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load employee master report tenant shadow compare."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading employee master report shadow results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No employee master shadow diagnostics are available.
      </div>
    );
  }

  const { shadowCompare } = data;
  const hasParity =
    shadowCompare.counts.currentReportEmployeeCount ===
      shadowCompare.counts.tenantScopedReportEmployeeCount &&
    shadowCompare.counts.missingOrganizationCount === 0 &&
    shadowCompare.warnings.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Current report employees"
          value={shadowCompare.counts.currentReportEmployeeCount}
        />
        <CountCard
          label="Tenant-scoped report employees"
          value={shadowCompare.counts.tenantScopedReportEmployeeCount}
        />
        <CountCard
          label="Missing organization assignments"
          value={shadowCompare.counts.missingOrganizationCount}
        />
        <CountCard
          label="Excluded by tenant filter"
          value={shadowCompare.counts.excludedByTenantFilterCount}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <h3 className="font-medium text-slate-900">Operator Guidance</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Parity means the tenant-scoped comparison produces the same report
            employee count as the current employee master result, with no
            missing organization assignments and no shadow warnings.
          </li>
          <li>
            Report scoping is not enforced yet. This panel only compares the
            current report population against a shadow organization filter so
            operators can review readiness without changing the live report page
            or exports.
          </li>
          <li>
            Missing organizations matter because an employee without an
            organization assignment cannot be included safely in future
            organization-scoped reporting.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Readiness signal
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              hasParity
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {hasParity ? "Parity achieved" : "Needs review"}
          </span>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Shadow warnings
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {shadowCompare.warnings.length > 0 ? (
            shadowCompare.warnings.map((warning) => (
              <WarningBadge key={warning}>{warning}</WarningBadge>
            ))
          ) : (
            <span className="text-sm text-slate-500">
              No shadow warnings for the current admin context.
            </span>
          )}
        </div>
        {shadowCompare.warnings.length > 0 ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {shadowCompare.warnings.map((warning) => (
              <li key={warning}>{WARNING_GUIDANCE[warning]}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-slate-900">
              Report Employees Excluded By Shadow Tenant Filter
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              This is the current employee master report population that would
              drop out if organization filtering were applied today.
            </p>
          </div>
          <div className="font-mono text-sm text-slate-600">
            organizationId: {shadowCompare.tenantContextOrganizationId ?? "null"}
          </div>
        </div>

        {shadowCompare.excludedByTenantFilter.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Employee
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Department
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    Manager
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                    organizationId
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {shadowCompare.excludedByTenantFilter.map((employee) => (
                  <tr key={employee.employeeId}>
                    <td className="px-3 py-2 text-slate-900">
                      {employee.employeeName}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {employee.workEmail}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{employee.status}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {employee.department ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {employee.managerName ?? "-"}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {employee.organizationId ?? "null"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-500">
            No employee master report rows would be excluded by the shadow
            tenant filter for this admin context.
          </div>
        )}
      </div>
    </div>
  );
}
