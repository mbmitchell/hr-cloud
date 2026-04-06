import {
  isAuthorizationError,
  requireAdmin,
} from "../../../lib/server/authorization";
import { buildAuthDiagnostics } from "../../../lib/server/auth-diagnostics";

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string | boolean | null;
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
            label="Email domain configured"
            value={diagnostics.entra.emailDomainConfigured}
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
