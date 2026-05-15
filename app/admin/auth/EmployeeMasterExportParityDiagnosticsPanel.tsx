"use client";

import { useEffect, useState } from "react";

type EmployeeMasterExportParityWarning =
  | "TENANT_CONTEXT_ORGANIZATION_ID_MISSING"
  | "PAGE_EXPORT_COUNT_MISMATCH"
  | "CSV_PDF_COUNT_MISMATCH"
  | "REPORT_EMPLOYEES_MISSING_ORGANIZATION"
  | "TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES"
  | "PAGE_FLAG_ENABLED_EXPORTS_REMAIN_GLOBAL";

type EmployeeMasterExportParityResponse = {
  mode: "export_parity_compare";
  parity: {
    flagState: {
      employeeMasterTenantFilterEnabled: boolean;
    };
    counts: {
      livePageCount: number;
      csvExportCount: number;
      pdfExportCount: number;
      tenantShadowScopedCount: number;
      missingOrganizationCount: number;
      excludedByTenantFilterCount: number;
    };
    expectedMismatchExplanation: string | null;
    excludedByTenantFilter: Array<{
      employeeId: string;
      employeeName: string;
      workEmail: string;
      status: string;
      department: string | null;
      managerName: string | null;
      organizationId: string | null;
    }>;
    warnings: EmployeeMasterExportParityWarning[];
  };
};

const WARNING_GUIDANCE: Record<EmployeeMasterExportParityWarning, string> = {
  TENANT_CONTEXT_ORGANIZATION_ID_MISSING:
    "The current admin does not yet resolve to an organization in TenantContext, so scoped export rollout should not proceed from this state.",
  PAGE_EXPORT_COUNT_MISMATCH:
    "The live employee master page count does not match one or both export counts for the same filter set. This is expected only during the current page-only pilot when the tenant filter flag is enabled.",
  CSV_PDF_COUNT_MISMATCH:
    "CSV and PDF export counts do not match each other for the same filter set. Exports should not join tenant-filter rollout until this is understood.",
  REPORT_EMPLOYEES_MISSING_ORGANIZATION:
    "Some employees in the report still have no organization assignment. Resolve those gaps before export scoping is considered safe.",
  TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES:
    "The shadow organization filter would exclude some employees from the current report population. Review those exclusions before any export scoping rollout.",
  PAGE_FLAG_ENABLED_EXPORTS_REMAIN_GLOBAL:
    "The employee master tenant filter flag is enabled for the live page, while CSV and PDF exports intentionally remain global during this pilot.",
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

export default function EmployeeMasterExportParityDiagnosticsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EmployeeMasterExportParityResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/admin/auth/employee-master-export-parity",
          {
            cache: "no-store",
          }
        );
        const payload = (await response.json()) as
          | EmployeeMasterExportParityResponse
          | { error?: string };
        const errorMessage =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load employee master export parity diagnostics.";

        if (!response.ok) {
          throw new Error(errorMessage);
        }

        if (!cancelled) {
          setData(payload as EmployeeMasterExportParityResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load employee master export parity diagnostics."
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
        Loading employee master export parity diagnostics...
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
        No employee master export parity diagnostics are available.
      </div>
    );
  }

  const { parity } = data;
  const hasParity =
    parity.counts.livePageCount === parity.counts.csvExportCount &&
    parity.counts.livePageCount === parity.counts.pdfExportCount &&
    parity.counts.missingOrganizationCount === 0 &&
    parity.warnings.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Live page count" value={parity.counts.livePageCount} />
        <CountCard
          label="CSV export count"
          value={parity.counts.csvExportCount}
        />
        <CountCard
          label="PDF export count"
          value={parity.counts.pdfExportCount}
        />
        <CountCard
          label="Tenant-shadow count"
          value={parity.counts.tenantShadowScopedCount}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CountCard
          label="Missing organization assignments"
          value={parity.counts.missingOrganizationCount}
        />
        <CountCard
          label="Excluded by tenant filter"
          value={parity.counts.excludedByTenantFilterCount}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <h3 className="font-medium text-slate-900">Operator Guidance</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Parity means the live page, CSV export, and PDF export all return
            the same employee count for the same filters, with no missing
            organization warnings and no diagnostics warnings.
          </li>
          <li>
            CSV and PDF remain intentionally global today. This is expected
            while the live employee master page uses the default-off tenant
            filter pilot and exports have not yet joined that rollout path.
          </li>
          <li>
            Exports should join the same feature flag only after operators have
            validated page-versus-export differences, CSV/PDF parity, and clean
            organization coverage in preview.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Parity signal
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
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              parity.flagState.employeeMasterTenantFilterEnabled
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Flag{" "}
            {parity.flagState.employeeMasterTenantFilterEnabled
              ? "enabled"
              : "disabled"}
          </span>
        </div>
      </div>

      {parity.expectedMismatchExplanation ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <h3 className="font-medium text-amber-900">
            Expected Mismatch Explanation
          </h3>
          <p className="mt-2">{parity.expectedMismatchExplanation}</p>
        </div>
      ) : null}

      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Diagnostics warnings
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {parity.warnings.length > 0 ? (
            parity.warnings.map((warning) => (
              <WarningBadge key={warning}>{warning}</WarningBadge>
            ))
          ) : (
            <span className="text-sm text-slate-500">
              No export parity warnings for the current admin context.
            </span>
          )}
        </div>
        {parity.warnings.length > 0 ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {parity.warnings.map((warning) => (
              <li key={warning}>{WARNING_GUIDANCE[warning]}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
