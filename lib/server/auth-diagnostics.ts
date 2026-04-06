import { getConfiguredTenantIdFromIssuer } from "../auth/microsoft-entra-sso";

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
      devCredentials: env.AUTH_ENABLE_DEV_AUTH === "true",
    },
    entra: {
      envPresence: entraEnvPresence,
      issuerTenantId: issuer ? getConfiguredTenantIdFromIssuer(issuer) : null,
      emailDomainConfigured: isPresent(env.AUTH_MICROSOFT_ENTRA_ID_EMAIL_DOMAIN),
      clientIdLooksLikeApplicationIdUri:
        typeof clientId === "string" && clientId.startsWith("api://"),
      callbackUrl: getMicrosoftCallbackUrl(nextAuthUrl),
    },
    devAuth: {
      enabled: env.AUTH_ENABLE_DEV_AUTH === "true",
      userSwitcherEnabled: env.AUTH_ENABLE_DEV_USER_SWITCHER === "true",
      passwordConfigured: isPresent(env.AUTH_DEV_PASSWORD),
      allowlistConfigured: isPresent(env.AUTH_DEV_AUTH_EMAIL_ALLOWLIST),
    },
  };
}
