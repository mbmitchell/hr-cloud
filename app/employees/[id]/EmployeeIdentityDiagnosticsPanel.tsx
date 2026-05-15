"use client";

import { useEffect, useState } from "react";

type LinkedIdentityFlag =
  | "EMPLOYEE_NOT_LINKED"
  | "EMPLOYEE_EMAIL_DUPLICATE"
  | "USER_EMAIL_DUPLICATE"
  | "EMPLOYEE_USER_EMAIL_MISMATCH"
  | "USER_LINKED_TO_MULTIPLE_EMPLOYEES"
  | "USER_WITHOUT_IDENTITY"
  | "EMPLOYEE_MISSING_ORGANIZATION"
  | "USER_MISSING_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION"
  | "USER_HAS_MEMBERSHIP_IN_DIFFERENT_ORGANIZATION"
  | "MEMBERSHIP_INACTIVE";

type IdentityDiagnosticsResponse = {
  details: {
    employee: {
      id: string;
      email: string;
      normalizedEmail: string | null;
      userId: string | null;
      organizationId: string | null;
    };
    organization: {
      id: string;
      slug: string;
      name: string;
      status: string;
    } | null;
    user: {
      id: string;
      email: string;
      isActive: boolean;
      organizationMembershipCount: number;
    } | null;
    identities: Array<{
      provider: string;
      providerAccountId: string;
    }>;
    relatedRecords: {
      employeeEmailMatchCount: number;
      userEmailMatchCount: number;
      linkedEmployeeIdsForUser: string[];
    };
    membership: {
      id: string;
      organizationId: string;
      role: string | null;
      status: string;
    } | null;
    membershipsInDifferentOrganizations: Array<{
      id: string;
      organizationId: string;
      role: string | null;
      status: string;
      organization: {
        id: string;
        slug: string;
        name: string;
        status: string;
      };
    }>;
    flags: LinkedIdentityFlag[];
  };
};

const FLAG_GUIDANCE: Record<LinkedIdentityFlag, string> = {
  EMPLOYEE_NOT_LINKED:
    "This employee has not been linked to a platform User yet. Use preview/apply backfill diagnostics before any manual cleanup.",
  EMPLOYEE_EMAIL_DUPLICATE:
    "Multiple employees share the same normalized email. Resolve the duplicate employee email state before relying on automated linkage.",
  USER_EMAIL_DUPLICATE:
    "Multiple User records share the same normalized email. Review user creation history and consolidate before further identity linking.",
  EMPLOYEE_USER_EMAIL_MISMATCH:
    "The linked User email does not match the employee email. Confirm which record is authoritative before making any linkage changes.",
  USER_LINKED_TO_MULTIPLE_EMPLOYEES:
    "The linked User is associated with more than one employee record. Review for duplicate employee records or an incorrect prior linkage.",
  USER_WITHOUT_IDENTITY:
    "The linked User exists but has no provider identity yet. This can be expected before Microsoft Entra sign-in has established a UserIdentity.",
  EMPLOYEE_MISSING_ORGANIZATION:
    "This employee does not currently have an organization assignment. Do not backfill memberships until the employee organization is known.",
  USER_MISSING_MEMBERSHIP_IN_EMPLOYEE_ORGANIZATION:
    "The employee is linked to a user, but that user does not yet have a membership in the employee's organization.",
  USER_HAS_MEMBERSHIP_IN_DIFFERENT_ORGANIZATION:
    "The linked user has membership in a different organization than the one currently assigned on the employee record. Review for organization mismatch before any tenant behavior is introduced.",
  MEMBERSHIP_INACTIVE:
    "A membership exists for the employee organization, but it is not ACTIVE. Review whether the inactive membership state is intentional before relying on it.",
};

function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "slate";
  children: React.ReactNode;
}) {
  const className =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export default function EmployeeIdentityDiagnosticsPanel({
  employeeId,
  defaultExpanded = false,
}: {
  employeeId: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(defaultExpanded);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<IdentityDiagnosticsResponse["details"] | null>(
    null
  );

  useEffect(() => {
    if (!expanded || details || loading) {
      return;
    }

    let cancelled = false;

    async function loadDetails() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/admin/auth/identity-linkage/${employeeId}`,
          {
            cache: "no-store",
          }
        );
        const data = (await response.json()) as
          | IdentityDiagnosticsResponse
          | { error?: string };
        const errorMessage =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Unable to load identity diagnostics.";

        if (!response.ok) {
          throw new Error(errorMessage);
        }

        if (!cancelled) {
          setDetails((data as IdentityDiagnosticsResponse).details);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load identity diagnostics."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [details, employeeId, expanded, loading]);

  const linked = Boolean(details?.employee.userId);
  const providerNames = Array.from(
    new Set(details?.identities.map((identity) => identity.provider) ?? [])
  );

  return (
    <div className="rounded-xl bg-white p-4 shadow sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Identity Diagnostics
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Read-only platform identity linkage status for this employee.
          </p>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-5 w-5 text-slate-500 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path
            d="M5 7.5 10 12.5l5-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          {loading ? (
            <div className="text-sm text-slate-500">
              Loading identity diagnostics...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : details ? (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Employee Linkage
                    </h4>
                    <StatusBadge tone={linked ? "green" : "amber"}>
                      {linked ? "Linked" : "Unlinked"}
                    </StatusBadge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Employee email</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.employee.email}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Normalized email</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.employee.normalizedEmail ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Linked user id</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.employee.userId ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Employee organization id</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.employee.organizationId ?? "-"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      User / Membership
                    </h4>
                    <StatusBadge tone={details.user?.isActive ? "green" : "slate"}>
                      {details.user
                        ? details.user.isActive
                          ? "Active User"
                          : "Inactive User"
                        : "No User"}
                    </StatusBadge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">User email</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.user?.email ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Organization memberships</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.user?.organizationMembershipCount ?? 0}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Provider names</dt>
                      <dd className="text-right text-slate-900">
                        {providerNames.length ? providerNames.join(", ") : "-"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Employee Organization
                    </h4>
                    <StatusBadge tone={details.organization ? "green" : "amber"}>
                      {details.organization ? "Present" : "Missing"}
                    </StatusBadge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Organization name</dt>
                      <dd className="text-right text-slate-900">
                        {details.organization?.name ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Organization slug</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.organization?.slug ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Organization status</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.organization?.status ?? "-"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Membership In Employee Organization
                    </h4>
                    <StatusBadge
                      tone={
                        details.membership?.status === "ACTIVE"
                          ? "green"
                          : details.membership
                            ? "amber"
                            : "slate"
                      }
                    >
                      {details.membership
                        ? details.membership.status === "ACTIVE"
                          ? "Active Membership"
                          : "Inactive Membership"
                        : "No Membership"}
                    </StatusBadge>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Membership role</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.membership?.role ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Membership status</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.membership?.status ?? "-"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">Other organization memberships</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {details.membershipsInDifferentOrganizations.length}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Diagnostics Flags
                </h4>
                {details.flags.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    No mismatch or conflict flags detected for this employee.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {details.flags.map((flag) => (
                      <div
                        key={flag}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                      >
                        <div className="font-mono text-xs font-semibold text-amber-900">
                          {flag}
                        </div>
                        <div className="mt-1 text-sm text-amber-800">
                          {FLAG_GUIDANCE[flag]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Membership Mismatch Signals
                </h4>
                {details.membershipsInDifferentOrganizations.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    No memberships in other organizations were detected for this
                    linked user.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {details.membershipsInDifferentOrganizations.map((membership) => (
                      <div
                        key={membership.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="text-sm font-medium text-slate-900">
                          {membership.organization.name}
                        </div>
                        <div className="mt-1 text-xs font-mono text-slate-600">
                          {membership.organization.slug} • {membership.organizationId}
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          Role: {membership.role ?? "-"} • Status: {membership.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Duplicate / Relationship Signals
                </h4>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Employee email match count</dt>
                    <dd className="text-right font-mono text-slate-900">
                      {details.relatedRecords.employeeEmailMatchCount}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">User email match count</dt>
                    <dd className="text-right font-mono text-slate-900">
                      {details.relatedRecords.userEmailMatchCount}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Linked employee ids for user</dt>
                    <dd className="text-right font-mono text-slate-900">
                      {details.relatedRecords.linkedEmployeeIdsForUser.length
                        ? details.relatedRecords.linkedEmployeeIdsForUser.join(", ")
                        : "-"}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
