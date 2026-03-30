import { prisma } from "../../../lib/db";
import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import PTORequestsClient from "./PTORequestsClient";

export default async function PTORequestsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const employeeId = String(session.user.employeeId || "").trim();

  if (!employeeId) {
    return (
      <div className="text-red-600">
        No employee record is linked to your account.
      </div>
    );
  }

  const requests = await prisma.pTORequest.findMany({
    where: {
      employeeId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = requests.map((request) => ({
    id: request.id,
    leaveType: request.leaveType,
    startDate: request.startDate.toISOString(),
    endDate: request.endDate.toISOString(),
    hours: request.hours,
    status: request.status,
    notes: request.notes ?? "",
  }));

  return <PTORequestsClient requests={rows} />;
}