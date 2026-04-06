import { prisma } from "../db";

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
