import {
  bindEmployeeToEntraIdentity,
  resolveAuthenticatedEmployeeByEmail,
  resolveAuthenticatedEmployeeByEntraIdentity,
} from "./resolve-authenticated-employee";

type AuthUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

type AuthProfile = Record<string, unknown> | null | undefined;

type ResolvedEmployee = Awaited<
  ReturnType<typeof resolveAuthenticatedEmployeeByEmail>
>;
type BoundEmployee = NonNullable<ResolvedEmployee>;

export type MicrosoftEntraClaims = {
  oid: string | null;
  tid: string | null;
  emailCandidates: string[];
  displayName: string | null;
};

export type InternalAuthenticatedUser = {
  employeeId: string;
  email: string;
  name: string;
  oid: string;
  tid: string;
};

export type MicrosoftEntraSignInFailureReason =
  | "invalid_issuer"
  | "missing_tid"
  | "tenant_mismatch"
  | "missing_oid"
  | "missing_allowed_email_domain"
  | "missing_company_email"
  | "no_employee_match"
  | "inactive_employee"
  | "identity_conflict";

export type MicrosoftEntraSignInResult =
  | {
      ok: true;
      authenticatedUser: InternalAuthenticatedUser;
      claims: MicrosoftEntraClaims;
      matchedBy: "entra_identity" | "email_fallback";
      bindingCreated: boolean;
    }
  | {
      ok: false;
      reason: MicrosoftEntraSignInFailureReason;
      claims: MicrosoftEntraClaims;
      matchedBy: null;
      bindingCreated: false;
    };

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value: unknown) {
  const normalizedValue = normalizeString(value).toLowerCase();
  return normalizedValue || null;
}

export function extractOid(input: { profile?: AuthProfile }) {
  const oid = normalizeString(input.profile?.oid);
  return oid || null;
}

export function extractTid(input: { profile?: AuthProfile }) {
  const tid = normalizeString(input.profile?.tid).toLowerCase();
  return tid || null;
}

export function extractDisplayName(input: {
  user?: AuthUser;
  profile?: AuthProfile;
}) {
  const candidates = [
    input.user?.name,
    typeof input.profile?.name === "string" ? input.profile.name : null,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeString(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return null;
}

export function extractEmailCandidates(input: {
  user?: AuthUser;
  profile?: AuthProfile;
}) {
  const candidates = [
    input.user?.email,
    typeof input.profile?.email === "string" ? input.profile.email : null,
    typeof input.profile?.preferred_username === "string"
      ? input.profile.preferred_username
      : null,
    typeof input.profile?.upn === "string" ? input.profile.upn : null,
  ];

  return Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeEmail(candidate))
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );
}

export function extractMicrosoftEntraClaims(input: {
  user?: AuthUser;
  profile?: AuthProfile;
}): MicrosoftEntraClaims {
  return {
    oid: extractOid(input),
    tid: extractTid(input),
    emailCandidates: extractEmailCandidates(input),
    displayName: extractDisplayName(input),
  };
}

export function getConfiguredTenantIdFromIssuer(issuer: string) {
  const normalizedIssuer = normalizeString(issuer);

  if (!normalizedIssuer) {
    return null;
  }

  try {
    const url = new URL(normalizedIssuer);
    const segments = url.pathname.split("/").filter(Boolean);
    const tenantId = segments[0];

    if (!tenantId || tenantId === "common") {
      return null;
    }

    return tenantId.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedEmailDomain(email: string, allowedDomain: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedAllowedDomain = normalizeString(allowedDomain).toLowerCase();

  if (!normalizedEmail || !normalizedAllowedDomain) {
    return false;
  }

  return normalizedEmail.endsWith(`@${normalizedAllowedDomain}`);
}

export async function authorizeMicrosoftEntraSignIn(input: {
  user: AuthUser;
  profile?: AuthProfile;
  issuer: string;
  allowedEmailDomain: string;
  resolveEmployeeByEntraIdentity?: (input: {
    entraOid: string;
    entraTid: string;
  }) => Promise<ResolvedEmployee>;
  resolveEmployeeByEmail?: (email: string) => Promise<ResolvedEmployee>;
  bindEmployeeToEntraIdentity?: (input: {
    employeeId: string;
    entraOid: string;
    entraTid: string;
  }) => Promise<BoundEmployee>;
}): Promise<MicrosoftEntraSignInResult> {
  const claims = extractMicrosoftEntraClaims(input);
  const configuredTenantId = getConfiguredTenantIdFromIssuer(input.issuer);

  if (!configuredTenantId) {
    return {
      ok: false,
      reason: "invalid_issuer",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  if (!claims.tid) {
    return {
      ok: false,
      reason: "missing_tid",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  if (claims.tid !== configuredTenantId) {
    return {
      ok: false,
      reason: "tenant_mismatch",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  if (!claims.oid) {
    return {
      ok: false,
      reason: "missing_oid",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  const resolveByEntraIdentity =
    input.resolveEmployeeByEntraIdentity ?? resolveAuthenticatedEmployeeByEntraIdentity;
  const resolveByEmail =
    input.resolveEmployeeByEmail ?? resolveAuthenticatedEmployeeByEmail;
  const bindEntraIdentity =
    input.bindEmployeeToEntraIdentity ?? bindEmployeeToEntraIdentity;

  const boundEmployee = await resolveByEntraIdentity({
    entraOid: claims.oid,
    entraTid: claims.tid,
  });

  if (boundEmployee) {
    if (boundEmployee.status !== "ACTIVE") {
      return {
        ok: false,
        reason: "inactive_employee",
        claims,
        matchedBy: null,
        bindingCreated: false,
      };
    }

    return {
      ok: true,
      authenticatedUser: {
        employeeId: boundEmployee.id,
        email: boundEmployee.email,
        name:
          claims.displayName ||
          `${boundEmployee.firstName} ${boundEmployee.lastName}`.trim(),
        oid: claims.oid,
        tid: claims.tid,
      },
      claims,
      matchedBy: "entra_identity",
      bindingCreated: false,
    };
  }

  const allowedEmailDomain = normalizeString(input.allowedEmailDomain).toLowerCase();

  if (!allowedEmailDomain) {
    return {
      ok: false,
      reason: "missing_allowed_email_domain",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  const email = claims.emailCandidates.find((candidate) =>
    isAllowedEmailDomain(candidate, allowedEmailDomain)
  );

  if (!email) {
    return {
      ok: false,
      reason: "missing_company_email",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  const employee = await resolveByEmail(email);

  if (!employee) {
    return {
      ok: false,
      reason: "no_employee_match",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  if (employee.status !== "ACTIVE") {
    return {
      ok: false,
      reason: "inactive_employee",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  if (
    (employee.entraOid && employee.entraOid !== claims.oid) ||
    (employee.entraTid && employee.entraTid !== claims.tid)
  ) {
    return {
      ok: false,
      reason: "identity_conflict",
      claims,
      matchedBy: null,
      bindingCreated: false,
    };
  }

  const boundEmployeeByEmail = await bindEntraIdentity({
    employeeId: employee.id,
    entraOid: claims.oid,
    entraTid: claims.tid,
  });

  return {
    ok: true,
    authenticatedUser: {
      employeeId: boundEmployeeByEmail.id,
      email: boundEmployeeByEmail.email,
      name:
        claims.displayName ||
        `${boundEmployeeByEmail.firstName} ${boundEmployeeByEmail.lastName}`.trim(),
      oid: claims.oid,
      tid: claims.tid,
    },
    claims,
    matchedBy: "email_fallback",
    bindingCreated: true,
  };
}
