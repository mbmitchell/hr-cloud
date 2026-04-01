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
      firstName: true,
      lastName: true,
    },
  });
}
