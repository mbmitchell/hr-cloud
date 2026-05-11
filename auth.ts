/**
 * Auth.js Configuration
 *
 * Centralizes authentication for the MFN HR platform.
 *
 * Responsibilities:
 * - Configure Microsoft Entra web sign-in for production use
 * - Keep the temporary dev credentials flow safely gated behind env flags
 * - Bind authenticated identities to internal Employee records
 * - Shape JWT and session payloads for the rest of the app
 *
 * Important dependencies:
 * - Auth.js / NextAuth providers
 * - Internal employee resolvers and Entra identity binding helpers
 * - Audit/security event logging
 * - Lightweight auth rate limiting
 *
 * Security considerations:
 * - Entra sign-in must resolve to an internal active Employee
 * - Session identity is reduced to internal app fields only
 * - Dev auth is break-glass only and should remain disabled in production
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { resolveAuthenticatedEmployeeByEmail } from "./lib/auth/resolve-authenticated-employee";
import {
  allowedMicrosoftEmailDomain,
  type InternalAuthenticatedUser,
  type MicrosoftEntraSignInResult,
  authorizeMicrosoftEntraSignIn,
  normalizeEmail,
} from "./lib/auth/microsoft-entra-sso";
import {
  isDevelopmentEnvironment,
  isDevAuthEnabled,
  isDevAuthFlagEnabled,
  isDevUserSwitcherEnabled,
  isDevUserSwitcherFlagEnabled,
} from "./lib/auth/dev-auth-flags";
import { logSecurityEvent } from "./lib/server/audit/security-events";
import {
  AUTH_RATE_LIMITS,
  buildCredentialsRateLimitKeys,
  consumeAuthRateLimit,
  getClientIpFromRequest,
  resetAuthRateLimits,
} from "./lib/server/security/auth-rate-limit";

declare global {
  // eslint-disable-next-line no-var
  var __mfnAuthWarningsLogged: boolean | undefined;
}

const isDevelopment = isDevelopmentEnvironment();
const devAuthFlagEnabled = isDevAuthFlagEnabled();
const devUserSwitcherFlagEnabled = isDevUserSwitcherFlagEnabled();
const allowDevAuth = isDevAuthEnabled();
const allowDevUserSwitcher = isDevUserSwitcherEnabled();
const allowMicrosoftEntraAuth = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);
const microsoftEntraClientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "";
const microsoftEntraIssuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "";
const devAuthEmailAllowlist = new Set(
  (process.env.AUTH_DEV_AUTH_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

type MicrosoftSignInSessionContext = InternalAuthenticatedUser & {
  matchedBy: "entra_identity" | "email_fallback";
  bindingCreated: boolean;
};

function stripSensitiveTokenFields(token: Record<string, unknown>) {
  delete token.access_token;
  delete token.refresh_token;
  delete token.id_token;
  delete token.scope;
  delete token.token_type;
  delete token.expires_at;
  delete token.session_state;
  delete token.ext_expires_in;
  delete token.oid;
  delete token.tid;
}

function logAuthFlow(
  level: "info" | "warn" | "error",
  event: string,
  metadata: Record<string, unknown> = {}
) {
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  logger(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      scope: "auth-flow",
      event,
      ...metadata,
    })
  );
}

function getSafeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { type: "UnknownError", message: String(error) };
  }

  const authError = error as Error & { type?: string };

  return {
    type: authError.type ?? authError.name,
    message: error.message,
    causeType:
      typeof error.cause === "object" &&
      error.cause !== null &&
      "err" in error.cause &&
      error.cause.err instanceof Error
        ? error.cause.err.name
        : undefined,
    causeMessage:
      typeof error.cause === "object" &&
      error.cause !== null &&
      "err" in error.cause &&
      error.cause.err instanceof Error
        ? error.cause.err.message
        : undefined,
  };
}

async function logSecurityEventSafely(
  input: Parameters<typeof logSecurityEvent>[0]
) {
  try {
    await logSecurityEvent(input);
  } catch (error) {
    logAuthFlow("error", "security-event.error", {
      eventType: input.eventType,
      provider: input.provider,
      outcome: input.outcome,
      ...getSafeErrorDetails(error),
    });
  }
}

function writeMicrosoftSignInSessionContext(
  target: Record<string, unknown>,
  context: MicrosoftSignInSessionContext
) {
  target.id = context.employeeId;
  target.employeeId = context.employeeId;
  target.email = context.email;
  target.name = context.name;
  target.entraOid = context.oid;
  target.entraTid = context.tid;
  target.matchedBy = context.matchedBy;
  target.bindingCreated = context.bindingCreated;
}

function readMicrosoftSignInSessionContext(
  value: unknown
): MicrosoftSignInSessionContext | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const employeeId = String(record.employeeId ?? record.id ?? "").trim();
  const email = String(record.email ?? "").trim().toLowerCase();
  const name = String(record.name ?? "").trim();
  const oid = String(record.entraOid ?? "").trim();
  const tid = String(record.entraTid ?? "").trim().toLowerCase();
  const matchedBy = record.matchedBy;

  if (
    !employeeId ||
    !email ||
    !name ||
    !oid ||
    !tid ||
    (matchedBy !== "entra_identity" && matchedBy !== "email_fallback")
  ) {
    return null;
  }

  return {
    employeeId,
    email,
    name,
    oid,
    tid,
    matchedBy,
    bindingCreated: record.bindingCreated === true,
  };
}

async function resolveMicrosoftSignInSessionContext(input: {
  user: Record<string, unknown>;
  profile: Record<string, unknown> | null;
}) {
  const existingContext = readMicrosoftSignInSessionContext(input.user);

  if (existingContext) {
    return existingContext;
  }

  const result = await authorizeMicrosoftEntraSignIn({
    user: {
      id:
        typeof input.user.id === "string" ? input.user.id : undefined,
      email:
        typeof input.user.email === "string" ? input.user.email : undefined,
      name:
        typeof input.user.name === "string" ? input.user.name : undefined,
    },
    profile: input.profile,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "",
  });

  if (!result.ok) {
    return null;
  }

  return {
    ...result.authenticatedUser,
    matchedBy: result.matchedBy,
    bindingCreated: result.bindingCreated,
  };
}

/**
 * Emits one-time startup warnings for auth settings that are safe in local
 * development but risky in a deployed internal HR system.
 */
function logAuthStartupWarnings() {
  if (globalThis.__mfnAuthWarningsLogged) {
    return;
  }

  globalThis.__mfnAuthWarningsLogged = true;

  if (!isDevelopment && devAuthFlagEnabled) {
    console.warn(
      "[auth] AUTH_ENABLE_DEV_AUTH=true outside development. The dev credentials provider remains disabled until the app runs in local development."
    );
  }

  if (!isDevelopment && devUserSwitcherFlagEnabled) {
    console.warn(
      "[auth] AUTH_ENABLE_DEV_USER_SWITCHER=true outside development. The dev user switcher remains disabled until the app runs in local development."
    );
  }

  if (microsoftEntraClientId.startsWith("api://")) {
    console.warn(
      "[auth] AUTH_MICROSOFT_ENTRA_ID_ID looks like an Application ID URI (api://...). Use the Microsoft Entra Application (client) ID GUID for Auth.js web sign-in."
    );
  }
}

logAuthStartupWarnings();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  useSecureCookies: !isDevelopment,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(allowMicrosoftEntraAuth
      ? [
          // Microsoft Entra ID is configured here as a confidential Web app
          // authorization-code callback flow. The redirect URI registered in
          // Entra must be:
          //   <NEXTAUTH_URL>/api/auth/callback/microsoft-entra-id
          //
          // AUTH_MICROSOFT_ENTRA_ID_ID must be the Application (client) ID
          // GUID from the app registration, not the api://... Application ID URI.
          MicrosoftEntraID({
            clientId: microsoftEntraClientId,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: microsoftEntraIssuer,
            authorization: {
              params: {
                scope: "openid profile email",
              },
            },
          }),
        ]
      : []),
    ...(allowDevAuth
      ? [Credentials({
      name: "Development Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // SECURITY:
        // The dev credentials flow is intentionally generic. We never reveal
        // whether an email exists, and we rate limit by IP and IP+email even
        // though upstream controls already exist at Nginx and Fail2Ban.
        const email = normalizeEmail(credentials?.email);
        const password = String(credentials?.password || "");
        const clientIp = getClientIpFromRequest(request);
        const rateLimitKeys = buildCredentialsRateLimitKeys({
          clientIp,
          normalizedEmail: email,
        });

        for (const key of rateLimitKeys) {
          const result = consumeAuthRateLimit(
            key,
            key.includes(":ip-email:")
              ? AUTH_RATE_LIMITS.credentialsByIpAndEmail
              : AUTH_RATE_LIMITS.credentialsByIp
          );

          if (!result.allowed) {
            await logSecurityEvent({
              eventType: "AUTH_RATE_LIMITED",
              provider: "credentials",
              outcome: "denied",
              normalizedEmail: email,
              reasonCode: "too_many_requests",
              entityType: "AuthSession",
              entityId: email ?? clientIp,
              metadata: {
                clientIp,
                retryAfterSeconds: result.retryAfterSeconds,
              },
            });
            return null;
          }
        }

        if (!email || !password) {
          await logSecurityEvent({
            eventType: "AUTH_DEV_CREDENTIALS_SIGN_IN_DENIED",
            provider: "credentials",
            outcome: "denied",
            normalizedEmail: email,
            reasonCode: "missing_credentials",
            entityType: "AuthSession",
            entityId: email ?? "unknown",
            metadata: {
              clientIp,
            },
          });
          return null;
        }

        if (password !== process.env.AUTH_DEV_PASSWORD) {
          await logSecurityEvent({
            eventType: "AUTH_DEV_CREDENTIALS_SIGN_IN_DENIED",
            provider: "credentials",
            outcome: "denied",
            normalizedEmail: email,
            reasonCode: "invalid_credentials",
            entityType: "AuthSession",
            entityId: email,
            metadata: {
              clientIp,
            },
          });
          return null;
        }

        if (
          devAuthEmailAllowlist.size > 0 &&
          !devAuthEmailAllowlist.has(email)
        ) {
          await logSecurityEvent({
            eventType: "AUTH_DEV_CREDENTIALS_SIGN_IN_DENIED",
            provider: "credentials",
            outcome: "denied",
            normalizedEmail: email,
            reasonCode: "allowlist_denied",
            entityType: "AuthSession",
            entityId: email,
            metadata: {
              clientIp,
            },
          });
          return null;
        }

        const employee = await resolveAuthenticatedEmployeeByEmail(email);

        if (!employee) {
          await logSecurityEvent({
            eventType: "AUTH_DEV_CREDENTIALS_SIGN_IN_DENIED",
            provider: "credentials",
            outcome: "denied",
            normalizedEmail: email,
            reasonCode: "no_employee_match",
            entityType: "AuthSession",
            entityId: email,
            metadata: {
              clientIp,
            },
          });
          return null;
        }

        if (employee.status !== "ACTIVE") {
          await logSecurityEvent({
            eventType: "AUTH_DEV_CREDENTIALS_SIGN_IN_DENIED",
            provider: "credentials",
            outcome: "denied",
            normalizedEmail: employee.email,
            employeeId: employee.id,
            reasonCode: "inactive_employee",
            entityType: "Employee",
            entityId: employee.id,
            metadata: {
              clientIp,
            },
          });
          return null;
        }

        resetAuthRateLimits(rateLimitKeys);

        await logSecurityEvent({
          eventType: "AUTH_DEV_CREDENTIALS_SIGN_IN_SUCCESS",
          provider: "credentials",
          outcome: "success",
          normalizedEmail: employee.email,
          employeeId: employee.id,
          entityType: "Employee",
          entityId: employee.id,
          metadata: {
            clientIp,
          },
        });

        return {
          id: employee.id,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
        };
      },
    })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      logAuthFlow("info", "signIn.callback.start", {
        provider: account?.provider ?? "unknown",
        normalizedEmail: normalizeEmail(user?.email) ?? null,
      });

      if (account?.provider === "credentials") {
        logAuthFlow("info", "signIn.callback.end", {
          provider: account.provider,
          allowed: true,
          employeeId: user.id ?? null,
        });
        return true;
      }

      if (account?.provider !== "microsoft-entra-id") {
        logAuthFlow("warn", "signIn.callback.end", {
          provider: account?.provider ?? "unknown",
          allowed: false,
          reason: "unsupported_provider",
        });
        return false;
      }

      // SECURITY:
      // Microsoft sign-in is accepted only after the external identity is
      // mapped to an internal active Employee. Email is only a bootstrap
      // path; steady-state identity is anchored on Entra oid + tid.
      const result = await authorizeMicrosoftEntraSignIn({
        user,
        profile: (profile as Record<string, unknown> | null) ?? null,
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "",
      });

      if (!result.ok) {
        const entityId =
          result.claims.oid ||
          result.claims.emailCandidates[0] ||
          "unknown";

        if (result.reason === "tenant_mismatch") {
          await logSecurityEvent({
            eventType: "AUTH_MICROSOFT_ENTRA_DENIED_TENANT_MISMATCH",
            provider: "microsoft-entra-id",
            outcome: "denied",
            normalizedEmail: result.claims.emailCandidates[0] ?? null,
            reasonCode: result.reason,
            entityType: "AuthSession",
            entityId,
            metadata: {
              tid: result.claims.tid,
              oid: result.claims.oid,
            },
          });
        } else if (
          result.reason === "no_employee_match" ||
          result.reason === "missing_company_email" ||
          result.reason === "identity_conflict"
        ) {
          await logSecurityEvent({
            eventType: "AUTH_MICROSOFT_ENTRA_DENIED_NO_EMPLOYEE_MATCH",
            provider: "microsoft-entra-id",
            outcome: "denied",
            normalizedEmail: result.claims.emailCandidates[0] ?? null,
            reasonCode: result.reason,
            entityType: "AuthSession",
            entityId,
            metadata: {
              tid: result.claims.tid,
              oid: result.claims.oid,
              requiredEmailDomain: allowedMicrosoftEmailDomain,
            },
          });
        } else if (result.reason === "inactive_employee") {
          await logSecurityEvent({
            eventType: "AUTH_MICROSOFT_ENTRA_DENIED_INACTIVE_EMPLOYEE",
            provider: "microsoft-entra-id",
            outcome: "denied",
            normalizedEmail: result.claims.emailCandidates[0] ?? null,
            reasonCode: result.reason,
            entityType: "AuthSession",
            entityId,
            metadata: {
              tid: result.claims.tid,
              oid: result.claims.oid,
            },
          });
        }

        logAuthFlow("warn", "signIn.callback.end", {
          provider: account.provider,
          allowed: false,
          reason: result.reason,
          normalizedEmail: result.claims.emailCandidates[0] ?? null,
        });
        return false;
      }

      if (result.bindingCreated) {
        await logSecurityEventSafely({
          eventType: "AUTH_MICROSOFT_ENTRA_IDENTITY_BOUND",
          provider: "microsoft-entra-id",
          outcome: "success",
          normalizedEmail: result.authenticatedUser.email,
          employeeId: result.authenticatedUser.employeeId,
          entityType: "Employee",
          entityId: result.authenticatedUser.employeeId,
          metadata: {
            entraOid: result.authenticatedUser.oid,
            entraTid: result.authenticatedUser.tid,
            matchedBy: result.matchedBy,
          },
        });
      }

      writeMicrosoftSignInSessionContext(
        user as Record<string, unknown>,
        {
          ...result.authenticatedUser,
          matchedBy: result.matchedBy,
          bindingCreated: result.bindingCreated,
        }
      );

      logAuthFlow("info", "signIn.callback.end", {
        provider: account.provider,
        allowed: true,
        employeeId: result.authenticatedUser.employeeId,
        normalizedEmail: result.authenticatedUser.email,
        matchedBy: result.matchedBy,
        bindingCreated: result.bindingCreated,
      });
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      const mutableToken = token as Record<string, unknown>;

      logAuthFlow("info", "jwt.callback.start", {
        trigger: trigger ?? "session",
        provider: account?.provider ?? null,
        hasUser: Boolean(user),
        existingEmployeeId:
          typeof mutableToken.employeeId === "string"
            ? mutableToken.employeeId
            : null,
      });

      stripSensitiveTokenFields(mutableToken);

      try {
        if (
          trigger === "signIn" &&
          account?.provider === "microsoft-entra-id" &&
          user &&
          typeof user === "object"
        ) {
          const microsoftContext = await resolveMicrosoftSignInSessionContext({
            user: user as Record<string, unknown>,
            profile: (profile as Record<string, unknown> | null) ?? null,
          });

          if (!microsoftContext) {
            logAuthFlow("warn", "jwt.callback.end", {
              trigger,
              provider: account.provider,
              status: "missing_internal_identity",
            });
            return null;
          }

          mutableToken.employeeId = microsoftContext.employeeId;
          mutableToken.email = microsoftContext.email;
          mutableToken.name = microsoftContext.name;

          await logSecurityEventSafely({
            eventType: "AUTH_MICROSOFT_ENTRA_SIGN_IN_SUCCESS",
            provider: "microsoft-entra-id",
            outcome: "success",
            normalizedEmail: microsoftContext.email,
            employeeId: microsoftContext.employeeId,
            entityType: "Employee",
            entityId: microsoftContext.employeeId,
            metadata: {
              entraOid: microsoftContext.oid,
              entraTid: microsoftContext.tid,
              matchedBy: microsoftContext.matchedBy,
              bindingCreated: microsoftContext.bindingCreated,
            },
          });
        } else if (user) {
          mutableToken.employeeId = user.id;
          mutableToken.email = user.email;
          mutableToken.name = user.name;
        }

        // SECURITY:
        // Microsoft Entra sign-ins must be tied to an internal employee record
        // before we allow a JWT to exist. If that binding is missing, we fail
        // closed here so the session cannot continue with a partial identity.
        if (
          mutableToken.employeeId == null ||
          String(mutableToken.employeeId).trim() === ""
        ) {
          logAuthFlow("warn", "jwt.callback.end", {
            trigger: trigger ?? "session",
            provider: account?.provider ?? null,
            status: "missing_employee_id",
          });
          return null;
        }

        logAuthFlow("info", "jwt.callback.end", {
          trigger: trigger ?? "session",
          provider: account?.provider ?? null,
          employeeId: String(mutableToken.employeeId),
          normalizedEmail:
            typeof mutableToken.email === "string" ? mutableToken.email : null,
        });
        return token;
      } catch (error) {
        logAuthFlow("error", "jwt.callback.error", {
          trigger: trigger ?? "session",
          provider: account?.provider ?? null,
          ...getSafeErrorDetails(error),
        });
        throw error;
      }
    },
    async session({ session, token }) {
      logAuthFlow("info", "session.callback.start", {
        hasSessionUser: Boolean(session.user),
        tokenEmployeeId:
          typeof token.employeeId === "string" ? token.employeeId : null,
      });

      // Keep the client session intentionally minimal. Authorization is
      // enforced server-side from internal employee/role data rather than a
      // broad client-visible auth payload.
      if (!session.user) {
        logAuthFlow("info", "session.callback.end", {
          hasSessionUser: false,
          employeeId: null,
        });
        return session;
      }

      const employeeId = String(token.employeeId || "").trim();

      if (!employeeId) {
        logAuthFlow("warn", "session.callback.end", {
          hasSessionUser: true,
          employeeId: null,
          status: "missing_employee_id",
        });
        return {
          ...session,
          user: undefined,
        } as unknown as typeof session;
      }

      session.user.employeeId = employeeId;
      session.user.email = String(token.email || "");
      session.user.name = String(token.name || "");

      logAuthFlow("info", "session.callback.end", {
        hasSessionUser: true,
        employeeId,
        normalizedEmail: session.user.email,
      });
      return session;
    },
    async redirect({ url, baseUrl }) {
      let resolvedUrl = baseUrl;

      if (url.startsWith("/")) {
        resolvedUrl = `${baseUrl}${url}`;
      } else {
        try {
          const parsedUrl = new URL(url);
          resolvedUrl = parsedUrl.origin === baseUrl ? url : baseUrl;
        } catch {
          resolvedUrl = baseUrl;
        }
      }

      logAuthFlow("info", "redirect.callback", {
        requestedUrl: url,
        baseUrl,
        resolvedUrl,
      });

      return resolvedUrl;
    },
  },
});
