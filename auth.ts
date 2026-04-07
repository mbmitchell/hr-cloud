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
  authorizeMicrosoftEntraSignIn,
  normalizeEmail,
} from "./lib/auth/microsoft-entra-sso";
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

const allowDevAuth = process.env.AUTH_ENABLE_DEV_AUTH === "true";
const allowDevUserSwitcher =
  process.env.AUTH_ENABLE_DEV_AUTH === "true" &&
  process.env.AUTH_ENABLE_DEV_USER_SWITCHER === "true";
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
const isDevelopment = process.env.NODE_ENV === "development";

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

/**
 * Emits one-time startup warnings for auth settings that are safe in local
 * development but risky in a deployed internal HR system.
 */
function logAuthStartupWarnings() {
  if (globalThis.__mfnAuthWarningsLogged) {
    return;
  }

  globalThis.__mfnAuthWarningsLogged = true;

  if (!isDevelopment && allowDevAuth) {
    console.warn(
      "[auth] AUTH_ENABLE_DEV_AUTH=true outside development. This temporary break-glass login path should be disabled once Microsoft Entra sign-in is verified."
    );
  }

  if (!isDevelopment && allowDevUserSwitcher) {
    console.warn(
      "[auth] AUTH_ENABLE_DEV_USER_SWITCHER=true outside development. The dev user switcher should remain disabled in deployed environments."
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
      if (account?.provider === "credentials") {
        return true;
      }

      if (account?.provider !== "microsoft-entra-id") {
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

        return false;
      }

      if (result.bindingCreated) {
        await logSecurityEvent({
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

      await logSecurityEvent({
        eventType: "AUTH_MICROSOFT_ENTRA_SIGN_IN_SUCCESS",
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

      user.id = result.authenticatedUser.employeeId;
      user.email = result.authenticatedUser.email;
      user.name = result.authenticatedUser.name;
      return true;
    },
    async jwt({ token, user }) {
      stripSensitiveTokenFields(token as Record<string, unknown>);

      if (user) {
        token.employeeId = user.id;
        token.email = user.email;
        token.name = user.name;
      }

      // SECURITY:
      // Microsoft Entra sign-ins must be tied to an internal employee record
      // before we allow a JWT to exist. If that binding is missing, we fail
      // closed here so the session cannot continue with a partial identity.
      if (
        token.employeeId == null ||
        String(token.employeeId).trim() === ""
      ) {
        return null;
      }

      return token;
    },
    async session({ session, token }) {
      // Keep the client session intentionally minimal. Authorization is
      // enforced server-side from internal employee/role data rather than a
      // broad client-visible auth payload.
      if (!session.user) {
        return session;
      }

      const employeeId = String(token.employeeId || "").trim();

      if (!employeeId) {
        return {
          ...session,
          user: undefined,
        } as unknown as typeof session;
      }

      session.user.employeeId = employeeId;
      session.user.email = String(token.email || "");
      session.user.name = String(token.name || "");

      return session;
    },
  },
});
