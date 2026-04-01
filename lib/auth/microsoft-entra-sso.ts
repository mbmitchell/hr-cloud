import { resolveAuthenticatedEmployeeByEmail } from "./resolve-authenticated-employee";

type AuthUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

type AuthProfile = Record<string, unknown> | null | undefined;

function getEmailFromAuthInput(input: {
  user?: AuthUser;
  profile?: AuthProfile;
}) {
  const profileEmailCandidates = [
    typeof input.profile?.email === "string" ? input.profile.email : null,
    typeof input.profile?.preferred_username === "string"
      ? input.profile.preferred_username
      : null,
    typeof input.profile?.upn === "string" ? input.profile.upn : null,
  ];

  const email = input.user?.email ?? profileEmailCandidates.find(Boolean) ?? null;
  return email ? email.trim().toLowerCase() : null;
}

export async function authorizeMicrosoftEntraSignIn(input: {
  user: AuthUser;
  profile?: AuthProfile;
  resolveEmployeeByEmail?: typeof resolveAuthenticatedEmployeeByEmail;
}) {
  const email = getEmailFromAuthInput(input);

  if (!email) {
    return null;
  }

  const resolveEmployeeByEmail =
    input.resolveEmployeeByEmail ?? resolveAuthenticatedEmployeeByEmail;

  const employee = await resolveEmployeeByEmail(email);

  if (!employee) {
    return null;
  }

  return {
    id: employee.id,
    email: employee.email,
    name: `${employee.firstName} ${employee.lastName}`,
  };
}

export { getEmailFromAuthInput };
