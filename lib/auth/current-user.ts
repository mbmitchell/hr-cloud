import { prisma } from "../db";
import { cookies } from "next/headers";
import { auth } from "../../auth";
import { isDevAuthEnabled } from "./dev-auth-flags";

export async function getCurrentUser() {
  const session = await auth();
  const cookieStore = await cookies();

  const devEmployeeId = isDevAuthEnabled()
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
