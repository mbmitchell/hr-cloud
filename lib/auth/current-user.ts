import { prisma } from "../db";
import { cookies } from "next/headers";
import { auth } from "../../auth";

export async function getCurrentUser() {
  const session = await auth();
  const cookieStore = await cookies();

  const isDev = process.env.NODE_ENV !== "production";
  const devEmployeeId = isDev
    ? cookieStore.get("dev_employee_id")?.value
    : undefined;

  if (devEmployeeId) {
    const selectedUser = await prisma.employee.findUnique({
      where: { id: devEmployeeId },
    });

    if (selectedUser) {
      return selectedUser;
    }
  }

  const email = session?.user?.email?.trim().toLowerCase();

  if (email) {
    const sessionUser = await prisma.employee.findUnique({
      where: { email },
    });

    if (sessionUser) {
      return sessionUser;
    }
  }

  return null;
}