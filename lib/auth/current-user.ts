import { prisma } from "../db";
import { cookies } from "next/headers";
import { auth } from "../../auth";

const allowDevAuth = process.env.AUTH_ENABLE_DEV_AUTH === "true";

export async function getCurrentUser() {
  const session = await auth();
  const cookieStore = await cookies();

  const devEmployeeId = allowDevAuth
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

  const employeeId = session?.user?.employeeId?.trim();

  if (employeeId) {
    const sessionUserById = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (sessionUserById) {
      return sessionUserById;
    }
  }

  return null;
}
