import { prisma } from "../../../lib/db";
import { dateToDateOnlyString } from "../../../lib/date-only";
import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import PTORequestsClient from "./PTORequestsClient";
import { getCurrentUser } from "../../../lib/auth/current-user";

export default async function PTORequestsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const employee = await getCurrentUser();

  if (!employee) {
    redirect("/login");
  }

  const requests = await prisma.pTORequest.findMany({
    where: {
      employeeId: employee.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = requests.map((request) => ({
    id: request.id,
    leaveType: request.leaveType,
    startDate: dateToDateOnlyString(request.startDate),
    endDate: dateToDateOnlyString(request.endDate),
    hours: request.hours,
    status: request.status,
    notes: request.notes ?? "",
  }));

  return <PTORequestsClient requests={rows} />;
}
