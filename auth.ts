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
import { prisma } from "./lib/db";
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
  delete token.picture;
  delete token.image;
  delete token.user;
  delete token.profile;
}

function buildSessionDisplayName(input: {
  name: unknown;
  email: string;
}) {
  const normalizedName =
    typeof input.name === "string" ? input.name.trim() : "";

  if (normalizedName) {
    return normalizedName;
  }

  return input.email;
}

function buildSessionIdentity(input: {
  employeeId: unknown;
  email: unknown;
  name: unknown;
}) {
  const employeeId = String(input.employeeId ?? "").trim();
  const email = normalizeEmail(input.email);

  if (!employeeId || !email) {
    return null;
  }

  return {
    employeeId,
    email,
    name: buildSessionDisplayName({
      name: input.name,
      email,
    }),
  };
}

function summarizeToken(token: Record<string, unknown>) {
  const tokenKeys = Object.keys(token).sort();

  try {
    return {
      tokenKeys,
      tokenBytes: Buffer.byteLength(JSON.stringify(token), "utf8"),
    };
  } catch (error) {
    return {
      tokenKeys,
      tokenBytes: null,
      serializationError: getSafeErrorDetails(error),
    };
  }
}

async function getEmployeeSessionSnapshot(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      email: true,
      status: true,
      managerId: true,
      manager: {
        select: {
          id: true,
        },
      },
      contactInfo: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          directReports: true,
        },
      },
      roleAssignments: {
        where: {
          isActive: true,
        },
        select: {
          role: {
            select: {
              code: true,
              isActive: true,
              rolePermissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  const permissionCodes = new Set<string>();
  const inactiveRoleCodes: string[] = [];

  for (const assignment of employee.roleAssignments) {
    if (!assignment.role.isActive) {
      inactiveRoleCodes.push(assignment.role.code);
    }

    for (const rolePermission of assignment.role.rolePermissions) {
      permissionCodes.add(rolePermission.permission.code);
    }
  }

  return {
    employeeId: employee.id,
    normalizedEmail: normalizeEmail(employee.email),
    status: employee.status,
    managerId: employee.managerId,
    managerExists: employee.managerId ? Boolean(employee.manager) : null,
    directReportCount: employee._count.directReports,
    contactInfoExists: Boolean(employee.contactInfo),
    roleCount: employee.roleAssignments.length,
    permissionCount: permissionCodes.size,
    inactiveRoleCodes,
  };
}

function getAuthLoggerDetails(error: Error) {
  const details = getSafeErrorDetails(error);
  const errorWithCause = error as Error & {
    type?: string;
    cause?: unknown;
  };
  const provider =
    typeof errorWithCause.cause === "object" &&
    errorWithCause.cause !== null &&
    "provider" in errorWithCause.cause &&
    typeof errorWithCause.cause.provider === "string"
      ? errorWithCause.cause.provider
      : undefined;

  return {
    authType: errorWithCause.type ?? error.name,
    provider,
    ...details,
  };
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
  const identity = buildSessionIdentity({
    employeeId: record.employeeId ?? record.id,
    email: record.email,
    name: record.name,
  });
  const oid = String(record.entraOid ?? "").trim();
  const tid = String(record.entraTid ?? "").trim().toLowerCase();
  const matchedBy = record.matchedBy;

  if (
    !identity ||
    !oid ||
    !tid ||
    (matchedBy !== "entra_identity" && matchedBy !== "email_fallback")
  ) {
    return null;
  }

  return {
    ...identity,
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
  logger: {
    error(error) {
      logAuthFlow("error", "authjs.logger.error", getAuthLoggerDetails(error));
    },
    warn(code) {
      logAuthFlow("warn", "authjs.logger.warn", {
        code,
      });
    },
    debug(message, metadata) {
      if (message !== "CHUNKING_SESSION_COOKIE") {
        return;
      }

      const safeMetadata =
        typeof metadata === "object" && metadata !== null
          ? metadata
          : undefined;

      logAuthFlow("warn", "authjs.logger.debug", {
        message,
        ...(safeMetadata ? { metadata: safeMetadata } : {}),
      });
    },
  },
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

          const sessionIdentity = buildSessionIdentity({
            employeeId: microsoftContext.employeeId,
            email: microsoftContext.email,
            name: microsoftContext.name,
          });

          if (!sessionIdentity) {
            logAuthFlow("warn", "jwt.callback.end", {
              trigger,
              provider: account.provider,
              status: "invalid_session_identity",
              employeeId: microsoftContext.employeeId,
              normalizedEmail: normalizeEmail(microsoftContext.email),
            });
            return null;
          }

          mutableToken.employeeId = sessionIdentity.employeeId;
          mutableToken.email = sessionIdentity.email;
          mutableToken.name = sessionIdentity.name;

          const sessionSnapshot = await getEmployeeSessionSnapshot(
            sessionIdentity.employeeId
          );

          if (!sessionSnapshot) {
            logAuthFlow("warn", "jwt.callback.end", {
              trigger,
              provider: account.provider,
              status: "missing_employee_row",
              employeeId: sessionIdentity.employeeId,
              normalizedEmail: sessionIdentity.email,
            });
            return null;
          }

          if (sessionSnapshot.status !== "ACTIVE") {
            logAuthFlow("warn", "jwt.callback.end", {
              trigger,
              provider: account.provider,
              status: "inactive_employee_snapshot",
              employeeId: sessionIdentity.employeeId,
              normalizedEmail: sessionIdentity.email,
              employeeStatus: sessionSnapshot.status,
            });
            return null;
          }

          logAuthFlow("info", "jwt.callback.identity.ready", {
            trigger,
            provider: account.provider,
            employeeId: sessionIdentity.employeeId,
            normalizedEmail: sessionIdentity.email,
            employeeStatus: sessionSnapshot.status,
            roleCount: sessionSnapshot.roleCount,
            permissionCount: sessionSnapshot.permissionCount,
            managerId: sessionSnapshot.managerId,
            managerExists: sessionSnapshot.managerExists,
            directReportCount: sessionSnapshot.directReportCount,
            contactInfoExists: sessionSnapshot.contactInfoExists,
            inactiveRoleCodes: sessionSnapshot.inactiveRoleCodes,
            ...summarizeToken(mutableToken),
          });
        } else if (user) {
          const sessionIdentity = buildSessionIdentity({
            employeeId: user.id,
            email: user.email,
            name: user.name,
          });

          if (!sessionIdentity) {
            logAuthFlow("warn", "jwt.callback.end", {
              trigger: trigger ?? "session",
              provider: account?.provider ?? null,
              status: "invalid_session_identity",
            });
            return null;
          }

          mutableToken.employeeId = sessionIdentity.employeeId;
          mutableToken.email = sessionIdentity.email;
          mutableToken.name = sessionIdentity.name;
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
            typeof mutableToken.email === "string"
              ? normalizeEmail(mutableToken.email)
              : null,
          ...summarizeToken(mutableToken),
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
      session.user.email = normalizeEmail(token.email) ?? "";
      session.user.name = buildSessionDisplayName({
        name: token.name,
        email: session.user.email,
      });

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
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "microsoft-entra-id") {
        return;
      }

      try {
        const microsoftContext = await resolveMicrosoftSignInSessionContext({
          user: user as Record<string, unknown>,
          profile: (profile as Record<string, unknown> | null) ?? null,
        });

        if (!microsoftContext) {
          logAuthFlow("warn", "events.signIn.end", {
            provider: account.provider,
            status: "missing_internal_identity",
          });
          return;
        }

        const sessionIdentity = buildSessionIdentity({
          employeeId: microsoftContext.employeeId,
          email: microsoftContext.email,
          name: microsoftContext.name,
        });

        if (!sessionIdentity) {
          logAuthFlow("warn", "events.signIn.end", {
            provider: account.provider,
            status: "invalid_session_identity",
            employeeId: microsoftContext.employeeId,
            normalizedEmail: normalizeEmail(microsoftContext.email),
          });
          return;
        }

        const sessionSnapshot = await getEmployeeSessionSnapshot(
          sessionIdentity.employeeId
        );

        await logSecurityEventSafely({
          eventType: "AUTH_MICROSOFT_ENTRA_SIGN_IN_SUCCESS",
          provider: "microsoft-entra-id",
          outcome: "success",
          normalizedEmail: sessionIdentity.email,
          employeeId: sessionIdentity.employeeId,
          entityType: "Employee",
          entityId: sessionIdentity.employeeId,
          metadata: {
            entraOid: microsoftContext.oid,
            entraTid: microsoftContext.tid,
            matchedBy: microsoftContext.matchedBy,
            bindingCreated: microsoftContext.bindingCreated,
            roleCount: sessionSnapshot?.roleCount ?? null,
            permissionCount: sessionSnapshot?.permissionCount ?? null,
            managerId: sessionSnapshot?.managerId ?? null,
            managerExists: sessionSnapshot?.managerExists ?? null,
            directReportCount: sessionSnapshot?.directReportCount ?? null,
            contactInfoExists: sessionSnapshot?.contactInfoExists ?? null,
            employeeStatus: sessionSnapshot?.status ?? null,
            inactiveRoleCodes: sessionSnapshot?.inactiveRoleCodes ?? [],
          },
        });

        logAuthFlow("info", "events.signIn.end", {
          provider: account.provider,
          status: "session_cookie_prepared",
          employeeId: sessionIdentity.employeeId,
          normalizedEmail: sessionIdentity.email,
          roleCount: sessionSnapshot?.roleCount ?? null,
          permissionCount: sessionSnapshot?.permissionCount ?? null,
        });
      } catch (error) {
        logAuthFlow("error", "events.signIn.error", {
          provider: account.provider,
          ...getSafeErrorDetails(error),
        });
      }
    },
  },
});
