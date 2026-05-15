"use client";

import { useEffect, useState } from "react";

type EmployeeDirectoryShadowWarning =
  | "TENANT_CONTEXT_ORGANIZATION_ID_MISSING"
  | "VISIBLE_EMPLOYEES_MISSING_ORGANIZATION"
  | "TENANT_FILTER_EXCLUDES_VISIBLE_EMPLOYEES";

type EmployeeDirectoryShadowResponse = {
  mode: "shadow_compare";
  shadowCompare: {
    tenantContextOrganizationId: string | null;
    counts: {
      currentVisibleEmployeeCount: number;
      tenantScopedVisibleEmployeeCount: number;
      missingOrganizationCount: number;
      excludedByTenantFilterCount: number;
    };
    excludedByTenantFilter: Array<{
      id: string;
      email: string;
      name: string;
      status: string;
      organizationId: string | null;
    }>;
    warnings: EmployeeDirectoryShadowWarning[];
  };
};

const WARNING_GUIDANCE: Record<EmployeeDirectoryShadowWarning, string> = {
  TENANT_CONTEXT_ORGANIZATION_ID_MISSING:
    "The current admin does not yet resolve to an organization in TenantContext, so scoped comparison cannot be treated as an enforcement-ready signal.",
  VISIBLE_EMPLOYEES_MISSING_ORGANIZATION:
    "Some currently visible employees still have no organization assignment. Resolve those gaps before enabling any real organization filtering.",
  TENANT_FILTER_EXCLUDES_VISIBLE_EMPLOYEES:
    "The shadow tenant filter would remove some employees from the current visible directory result. Review exclusions before any enforcement work begins.",
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

export default function EmployeeDirectoryShadowResultsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EmployeeDirectoryShadowResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/auth/employee-directory-shadow", {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | EmployeeDirectoryShadowResponse
          | { error?: string };
        const errorMessage =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load employee directory tenant shadow compare.";

        if (!response.ok) {
          throw new Error(errorMessage);
        }

        if (!cancelled) {
          setData(payload as EmployeeDirectoryShadowResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load employee directory tenant shadow compare."
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
        Loading employee directory shadow results...
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
        No employee directory shadow diagnostics are available.
      </div>
    );
  }

  const { shadowCompare } = data;
  const hasParity =
    shadowCompare.counts.currentVisibleEmployeeCount ===
      shadowCompare.counts.tenantScopedVisibleEmployeeCount &&
    shadowCompare.counts.missingOrganizationCount === 0 &&
    shadowCompare.warnings.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Current visible employees"
          value={shadowCompare.counts.currentVisibleEmployeeCount}
        />
        <CountCard
          label="Tenant-scoped visible employees"
          value={shadowCompare.counts.tenantScopedVisibleEmployeeCount}
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
            Parity means the tenant-scoped comparison produces the same visible
            employee count as the current directory, with no missing
            organization assignments and no shadow warnings.
          </li>
          <li>
            Missing organization assignments mean some visible employees still
            cannot be scoped safely by organization. Those records should be
            corrected before any enforcement work begins.
          </li>
          <li>
            No enforcement is active yet. This panel is only a read-only shadow
            comparison so operators can review readiness without changing the
            live <code>/employees</code> experience.
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
              Employees Excluded By Shadow Tenant Filter
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              This is the current visible set that would drop out if
              organization filtering were applied today.
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
                    organizationId
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {shadowCompare.excludedByTenantFilter.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-3 py-2 text-slate-900">{employee.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {employee.email}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{employee.status}</td>
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
            No currently visible employees would be excluded by the shadow
            tenant filter for this admin context.
          </div>
        )}
      </div>
    </div>
  );
}
