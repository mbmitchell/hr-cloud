/**
 * Internal Employee Identity Resolvers
 *
 * These helpers map authenticated identities onto Employee records used by the
 * HR application.
 *
 * Responsibilities:
 * - Resolve employees by normalized email for bootstrap/dev sign-in paths
 * - Resolve employees by stable Entra identity for steady-state SSO
 * - Persist the first successful Entra identity binding
 *
 * Security considerations:
 * - Select only the identity fields needed for auth decisions
 * - Normalize email and tenant identifiers before querying
 */
import { prisma } from "../db";

/**
 * Looks up an employee by normalized email address.
 */
export async function resolveAuthenticatedEmployeeByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  return prisma.employee.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
      entraOid: true,
      entraTid: true,
      firstName: true,
      lastName: true,
    },
  });
}

/**
 * Resolves a previously bound Entra identity to the matching employee.
 */
export async function resolveAuthenticatedEmployeeByEntraIdentity(input: {
  entraOid: string;
  entraTid: string;
}) {
  const entraOid = input.entraOid.trim();
  const entraTid = input.entraTid.trim().toLowerCase();

  if (!entraOid || !entraTid) {
    return null;
  }

  return prisma.employee.findFirst({
    where: {
      entraOid,
      entraTid,
    },
    select: {
      id: true,
      email: true,
      status: true,
      entraOid: true,
      entraTid: true,
      firstName: true,
      lastName: true,
    },
  });
}

/**
 * Stores the stable Entra identity on the employee record after the first
 * successful email bootstrap login.
 */
export async function bindEmployeeToEntraIdentity(input: {
  employeeId: string;
  entraOid: string;
  entraTid: string;
}) {
  return prisma.employee.update({
    where: { id: input.employeeId },
    data: {
      entraOid: input.entraOid.trim(),
      entraTid: input.entraTid.trim().toLowerCase(),
    },
    select: {
      id: true,
      email: true,
      status: true,
      entraOid: true,
      entraTid: true,
      firstName: true,
      lastName: true,
    },
  });
}
