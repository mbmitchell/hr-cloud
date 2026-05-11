import {
  allowedMicrosoftEmailDomain,
  getConfiguredTenantIdFromIssuer,
} from "../auth/microsoft-entra-sso";
import {
  isDevAuthEnabled,
  isDevUserSwitcherEnabled,
} from "../auth/dev-auth-flags";

type AuthDiagnosticsEnv = Record<string, string | undefined>;

function isPresent(value: string | undefined) {
  return Boolean(value && value.trim());
}

function getMicrosoftCallbackUrl(nextAuthUrl: string | undefined) {
  if (!isPresent(nextAuthUrl)) {
    return null;
  }

  return `${nextAuthUrl!.replace(/\/$/, "")}/api/auth/callback/microsoft-entra-id`;
}

export function buildAuthDiagnostics(env: AuthDiagnosticsEnv = process.env) {
  const clientId = env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  const issuer = env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  const nextAuthUrl = env.NEXTAUTH_URL;

  const entraEnvPresence = {
    clientId: isPresent(clientId),
    clientSecret: isPresent(clientSecret),
    issuer: isPresent(issuer),
    nextAuthUrl: isPresent(nextAuthUrl),
  };

  return {
    providers: {
      microsoft365:
        entraEnvPresence.clientId &&
        entraEnvPresence.clientSecret &&
        entraEnvPresence.issuer,
      devCredentials: isDevAuthEnabled(env),
    },
    entra: {
      envPresence: entraEnvPresence,
      issuerTenantId: issuer ? getConfiguredTenantIdFromIssuer(issuer) : null,
      allowedEmailDomain: allowedMicrosoftEmailDomain,
      clientIdLooksLikeApplicationIdUri:
        typeof clientId === "string" && clientId.startsWith("api://"),
      callbackUrl: getMicrosoftCallbackUrl(nextAuthUrl),
    },
    devAuth: {
      enabled: isDevAuthEnabled(env),
      userSwitcherEnabled: isDevUserSwitcherEnabled(env),
      passwordConfigured: isPresent(env.AUTH_DEV_PASSWORD),
      allowlistConfigured: isPresent(env.AUTH_DEV_AUTH_EMAIL_ALLOWLIST),
    },
  };
}
