import Link from "next/link";

import EmployeeDirectoryShadowResultsPanel from "./EmployeeDirectoryShadowResultsPanel";
import EmployeeMasterExportParityDiagnosticsPanel from "./EmployeeMasterExportParityDiagnosticsPanel";
import EmployeeMasterShadowResultsPanel from "./EmployeeMasterShadowResultsPanel";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../lib/server/authorization";
import { buildAuthDiagnostics } from "../../../lib/server/auth-diagnostics";
import { getUnifiedIdentityOrganizationReadinessSummary } from "../../../lib/server/auth/identity-linkage";
import { resolveTenantContext } from "../../../lib/server/tenant-context";

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null;
}) {
  const displayValue =
    typeof value === "boolean" ? (value ? "Yes" : "No") : value ?? "Not available";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-2 text-sm">
      <div className="text-slate-700">{label}</div>
      <div className="font-mono text-slate-900">{displayValue}</div>
    </div>
  );
}

function ToneBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  const className =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function SummaryStat({
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

export default async function AuthDiagnosticsPage() {
  try {
    await requireAdmin({
      attemptedAction: "AUTH_DIAGNOSTICS_VIEW",
      entityType: "AuthDiagnostics",
      entityId: "auth-status",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return (
        <div className="text-red-600">
          You do not have access to auth diagnostics.
        </div>
      );
    }

    throw error;
  }

  const diagnostics = buildAuthDiagnostics();
  const readiness = await getUnifiedIdentityOrganizationReadinessSummary();
  const tenantContext = await resolveTenantContext();
  const readinessTone =
    readiness.overallStatus === "READY"
      ? "green"
      : readiness.overallStatus === "NEEDS_REVIEW"
        ? "amber"
        : "red";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Auth Diagnostics</h1>
        <p className="mt-2 text-sm text-slate-600">
          Internal-only auth verification view. This page reports enabled providers
          and required Entra configuration presence without showing secret values.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">Providers</h2>
        <div className="mt-4">
          <StatusRow
            label="Microsoft 365 provider enabled"
            value={diagnostics.providers.microsoft365}
          />
          <StatusRow
            label="Dev credentials enabled"
            value={diagnostics.providers.devCredentials}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">Entra Configuration</h2>
        <div className="mt-4">
          <StatusRow
            label="Client ID configured"
            value={diagnostics.entra.envPresence.clientId}
          />
          <StatusRow
            label="Client secret configured"
            value={diagnostics.entra.envPresence.clientSecret}
          />
          <StatusRow
            label="Issuer configured"
            value={diagnostics.entra.envPresence.issuer}
          />
          <StatusRow
            label="NEXTAUTH_URL configured"
            value={diagnostics.entra.envPresence.nextAuthUrl}
          />
          <StatusRow
            label="Parsed issuer tenant ID"
            value={diagnostics.entra.issuerTenantId}
          />
          <StatusRow
            label="Allowed Microsoft email domain"
            value={diagnostics.entra.allowedEmailDomain}
          />
          <StatusRow
            label="Client ID looks like api:// URI"
            value={diagnostics.entra.clientIdLooksLikeApplicationIdUri}
          />
          <StatusRow
            label="Expected callback URL"
            value={diagnostics.entra.callbackUrl}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900">
              Current Admin Tenant Context
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Read-only resolver output for the current authenticated admin.
              This does not change authorization or data scoping yet.
            </p>
          </div>
          <ToneBadge
            tone={
              tenantContext.warnings.length === 0
                ? "green"
                : tenantContext.source === "transition_default_organization"
                  ? "amber"
                  : "red"
            }
          >
            {tenantContext.source}
          </ToneBadge>
        </div>

        <div className="mt-5">
          <StatusRow label="Employee ID" value={tenantContext.employeeId} />
          <StatusRow label="User ID" value={tenantContext.userId} />
          <StatusRow
            label="Organization ID"
            value={tenantContext.organizationId}
          />
          <StatusRow
            label="Resolved organization slug"
            value={tenantContext.organization?.slug ?? null}
          />
          <StatusRow
            label="Resolved organization name"
            value={tenantContext.organization?.name ?? null}
          />
          <StatusRow
            label="Linked user email"
            value={tenantContext.user?.email ?? null}
          />
          <StatusRow
            label="Linked user identity count"
            value={tenantContext.user?.identityCount ?? null}
          />
          <StatusRow
            label="Linked user membership count"
            value={tenantContext.user?.membershipCount ?? null}
          />
          <StatusRow
            label="Membership role"
            value={tenantContext.membership?.role ?? null}
          />
          <StatusRow
            label="Membership status"
            value={tenantContext.membership?.status ?? null}
          />
          <StatusRow
            label="Role code count"
            value={tenantContext.roleCodes.length}
          />
          <StatusRow
            label="Permission code count"
            value={tenantContext.permissionCodes.length}
          />
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <h3 className="font-medium text-slate-900">Resolved Codes</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Roles
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tenantContext.roleCodes.length > 0 ? (
                  tenantContext.roleCodes.map((roleCode) => (
                    <span
                      key={roleCode}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700"
                    >
                      {roleCode}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">No role codes resolved.</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Permissions
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tenantContext.permissionCodes.length > 0 ? (
                  tenantContext.permissionCodes.map((permissionCode) => (
                    <span
                      key={permissionCode}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700"
                    >
                      {permissionCode}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">
                    No permission codes resolved.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <h3 className="font-medium text-slate-900">Resolver Warnings</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tenantContext.warnings.length > 0 ? (
              tenantContext.warnings.map((warning) => (
                <span
                  key={warning}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-xs text-amber-700"
                >
                  {warning}
                </span>
              ))
            ) : (
              <span className="text-slate-500">
                No tenant-context warnings for the current admin.
              </span>
            )}
          </div>
          <p className="mt-3">
            API preview:{" "}
            <Link
              href="/api/admin/auth/tenant-context"
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              /api/admin/auth/tenant-context
            </Link>
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900">
              Unified Identity And Organization Readiness
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Read-only readiness view for the current Employee to User to
              UserIdentity to OrganizationMembership path before tenant
              enforcement is introduced.
            </p>
          </div>
          <ToneBadge tone={readinessTone}>
            {readiness.overallStatus === "READY"
              ? "Ready"
              : readiness.overallStatus === "NEEDS_REVIEW"
                ? "Needs Review"
                : "Not Ready"}
          </ToneBadge>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryStat
            label="Total employees"
            value={readiness.totals.totalEmployees}
          />
          <SummaryStat
            label="Employees missing user linkage"
            value={readiness.readiness.employeesMissingUserLinkage}
          />
          <SummaryStat
            label="Employees missing organization"
            value={readiness.readiness.employeesMissingOrganization}
          />
          <SummaryStat
            label="Linked users missing membership"
            value={readiness.readiness.linkedUsersMissingOrganizationMembership}
          />
          <SummaryStat
            label="Users without identities"
            value={readiness.readiness.usersWithoutIdentities}
          />
          <SummaryStat
            label="Inactive memberships"
            value={readiness.readiness.inactiveMemberships}
          />
        </div>

        <div className="mt-5">
          <StatusRow
            label="Duplicate or ambiguous email risks"
            value={readiness.readiness.duplicateOrAmbiguousEmailRisks}
          />
          <StatusRow
            label="Employee email duplicate risks"
            value={readiness.riskBreakdown.employeeEmailDuplicateRisks}
          />
          <StatusRow
            label="User email duplicate risks"
            value={readiness.riskBreakdown.userEmailDuplicateRisks}
          />
          <StatusRow
            label="Employee and user email mismatch risks"
            value={readiness.riskBreakdown.employeeUserEmailMismatchRisks}
          />
          <StatusRow
            label="Users linked to multiple employees"
            value={readiness.riskBreakdown.userLinkedToMultipleEmployeesRisks}
          />
          <StatusRow
            label="Linked users without identities"
            value={readiness.readiness.linkedUsersWithoutIdentities}
          />
          <StatusRow
            label="Users with membership in a different organization"
            value={readiness.readiness.usersWithMembershipInDifferentOrganization}
          />
          <StatusRow
            label="Blocking issue count"
            value={readiness.counts.blockingIssueCount}
          />
          <StatusRow
            label="Warning issue count"
            value={readiness.counts.warningIssueCount}
          />
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <h3 className="font-medium text-slate-900">Operator Review Flow</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Start with employee linkage coverage in{" "}
              <code>{readiness.references.identityCoverageDoc}</code> or the
              preview endpoint{" "}
              <Link
                href={readiness.references.identityLinkagePreviewPath}
                className="font-medium text-slate-900 underline underline-offset-2"
              >
                {readiness.references.identityLinkagePreviewPath}
              </Link>
              .
            </li>
            <li>
              Review organization membership readiness in{" "}
              <code>{readiness.references.organizationMembershipDoc}</code> or
              the preview endpoint{" "}
              <Link
                href={readiness.references.organizationMembershipPreviewPath}
                className="font-medium text-slate-900 underline underline-offset-2"
              >
                {readiness.references.organizationMembershipPreviewPath}
              </Link>
              .
            </li>
            <li>
              Use <code>{readiness.references.remediationPlaybookDoc}</code> to
              resolve flagged mismatch, duplicate-email, and inactive-membership
              cases before any tenant enforcement work begins.
            </li>
            <li>
              Keep this workflow read-only for now. No linkage or membership
              apply actions should run until the flagged data issues are
              understood.
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-medium text-slate-900">
            Employee Directory Shadow Results
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Read-only comparison of the current employee directory against a
            shadow organization filter. This does not change the live directory
            result set or enable tenant enforcement.
          </p>
        </div>

        <div className="mt-5">
          <EmployeeDirectoryShadowResultsPanel />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-medium text-slate-900">
            Employee Master Report Shadow Results
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Read-only comparison of the current employee master report against a
            shadow organization filter. This does not change the live report
            page, CSV export, PDF export, or enable tenant enforcement.
          </p>
        </div>

        <div className="mt-5">
          <EmployeeMasterShadowResultsPanel />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-medium text-slate-900">
            Employee Master Export Parity Diagnostics
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Read-only comparison of the live employee master page, CSV export,
            PDF export, and tenant-shadow counts. This does not change live
            report or export behavior.
          </p>
        </div>

        <div className="mt-5">
          <EmployeeMasterExportParityDiagnosticsPanel />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">Dev Auth Safeguards</h2>
        <div className="mt-4">
          <StatusRow
            label="Dev auth enabled"
            value={diagnostics.devAuth.enabled}
          />
          <StatusRow
            label="Dev user switcher enabled"
            value={diagnostics.devAuth.userSwitcherEnabled}
          />
          <StatusRow
            label="Dev password configured"
            value={diagnostics.devAuth.passwordConfigured}
          />
          <StatusRow
            label="Dev allowlist configured"
            value={diagnostics.devAuth.allowlistConfigured}
          />
        </div>
      </section>
    </div>
  );
}
