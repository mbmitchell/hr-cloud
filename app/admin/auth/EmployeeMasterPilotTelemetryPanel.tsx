"use client";

import { useEffect, useState } from "react";

type EmployeeMasterPilotTelemetryWarning =
  | "TENANT_CONTEXT_ORGANIZATION_ID_MISSING"
  | "PAGE_EXPORT_COUNT_MISMATCH"
  | "CSV_PDF_COUNT_MISMATCH"
  | "REPORT_EMPLOYEES_MISSING_ORGANIZATION"
  | "TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES"
  | "PAGE_FLAG_ENABLED_EXPORTS_REMAIN_GLOBAL";

type EmployeeMasterPilotTelemetryResponse = {
  mode: "pilot_telemetry";
  telemetry: {
    status: "HEALTHY" | "WARNING" | "BLOCKING";
    currentOrganizationSlug: string | null;
    currentTenantContextOrganizationId: string | null;
    currentFeatureFlagState: boolean;
    counts: {
      currentLivePageCount: number;
      tenantScopedCount: number;
      excludedRowCount: number;
      missingOrganizationCount: number;
      csvExportCount: number;
      pdfExportCount: number;
    };
    exportPageMismatchState: boolean;
    expectedMismatchExplanation: string | null;
    warnings: EmployeeMasterPilotTelemetryWarning[];
    rolloutGuidance: {
      rollbackRecommended: boolean;
      rolloutExpansionBlocked: boolean;
      statusMeaning: string;
    };
  };
};

const WARNING_GUIDANCE: Record<EmployeeMasterPilotTelemetryWarning, string> = {
  TENANT_CONTEXT_ORGANIZATION_ID_MISSING:
    "Rollback or halt scoped validation. The acting admin is missing TenantContext.organizationId.",
  PAGE_EXPORT_COUNT_MISMATCH:
    "This is expected only while the live page is scoped and exports remain global. Do not expand rollout until operators confirm the mismatch is understood.",
  CSV_PDF_COUNT_MISMATCH:
    "Rollback or halt expansion. CSV and PDF exports should not diverge for the same filter set.",
  REPORT_EMPLOYEES_MISSING_ORGANIZATION:
    "Rollback or halt expansion until organization assignment gaps are resolved for in-scope report rows.",
  TENANT_FILTER_EXCLUDES_REPORT_EMPLOYEES:
    "Review excluded rows before expanding rollout. This can be expected during cross-tenant validation, but it must be understood.",
  PAGE_FLAG_ENABLED_EXPORTS_REMAIN_GLOBAL:
    "This is an expected pilot warning while the employee master page is feature-flagged and exports remain intentionally global.",
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

function StatusBadge({
  status,
}: {
  status: "HEALTHY" | "WARNING" | "BLOCKING";
}) {
  const className =
    status === "HEALTHY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "WARNING"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {status}
    </span>
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

export default function EmployeeMasterPilotTelemetryPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] =
    useState<EmployeeMasterPilotTelemetryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/auth/employee-master-telemetry", {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | EmployeeMasterPilotTelemetryResponse
          | { error?: string };
        const errorMessage =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load employee master pilot telemetry.";

        if (!response.ok) {
          throw new Error(errorMessage);
        }

        if (!cancelled) {
          setData(payload as EmployeeMasterPilotTelemetryResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load employee master pilot telemetry."
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
        Loading employee master rollout telemetry...
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
        No employee master rollout telemetry is available.
      </div>
    );
  }

  const { telemetry } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Current organization
          </div>
          <div className="mt-1 font-mono text-sm text-slate-700">
            {telemetry.currentOrganizationSlug ?? "null"} /{" "}
            {telemetry.currentTenantContextOrganizationId ?? "null"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={telemetry.status} />
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              telemetry.currentFeatureFlagState
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Flag {telemetry.currentFeatureFlagState ? "enabled" : "disabled"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Current live page count"
          value={telemetry.counts.currentLivePageCount}
        />
        <CountCard
          label="Tenant-scoped count"
          value={telemetry.counts.tenantScopedCount}
        />
        <CountCard
          label="Excluded row count"
          value={telemetry.counts.excludedRowCount}
        />
        <CountCard
          label="Missing organization count"
          value={telemetry.counts.missingOrganizationCount}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CountCard
          label="CSV export count"
          value={telemetry.counts.csvExportCount}
        />
        <CountCard
          label="PDF export count"
          value={telemetry.counts.pdfExportCount}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <h3 className="font-medium text-slate-900">Telemetry Guidance</h3>
        <p className="mt-3">{telemetry.rolloutGuidance.statusMeaning}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>HEALTHY</strong> means current preview telemetry is stable
            for the acting organization and there are no blocking parity or
            organization-assignment issues.
          </li>
          <li>
            <strong>WARNING</strong> means the pilot is still operating in an
            expected-but-reviewable state. Rollout expansion should pause until
            operators confirm the warning is understood and accepted.
          </li>
          <li>
            <strong>BLOCKING</strong> means rollback or halt is recommended
            until the issue is resolved, such as missing tenant context,
            missing organizations, or CSV/PDF divergence.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              telemetry.rolloutGuidance.rollbackRecommended
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {telemetry.rolloutGuidance.rollbackRecommended
              ? "Rollback recommended"
              : "Rollback not currently indicated"}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              telemetry.rolloutGuidance.rolloutExpansionBlocked
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {telemetry.rolloutGuidance.rolloutExpansionBlocked
              ? "Rollout expansion blocked"
              : "Rollout expansion not blocked by current telemetry"}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              telemetry.exportPageMismatchState
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {telemetry.exportPageMismatchState
              ? "Page/export mismatch present"
              : "No page/export mismatch"}
          </span>
        </div>
      </div>

      {telemetry.expectedMismatchExplanation ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <h3 className="font-medium text-amber-900">
            Expected Mismatch Explanation
          </h3>
          <p className="mt-2">{telemetry.expectedMismatchExplanation}</p>
        </div>
      ) : null}

      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Telemetry warnings
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {telemetry.warnings.length > 0 ? (
            telemetry.warnings.map((warning) => (
              <WarningBadge key={warning}>{warning}</WarningBadge>
            ))
          ) : (
            <span className="text-sm text-slate-500">
              No employee master rollout telemetry warnings for the current
              admin context.
            </span>
          )}
        </div>
        {telemetry.warnings.length > 0 ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {telemetry.warnings.map((warning) => (
              <li key={warning}>{WARNING_GUIDANCE[warning]}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
