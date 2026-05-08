import { auth } from "../../auth";
import { redirect } from "next/navigation";
import CompanyCalendar from "../../components/calendar/company-calendar";
import { prisma } from "../../lib/db";
import { dateToDateOnlyString } from "../../lib/date-only";

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const requests = await prisma.pTORequest.findMany({
    where: {
      status: {
        in: ["APPROVED", "PENDING"],
      },
    },
    include: {
      employee: true,
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  const events = requests.map((request) => ({
    id: request.id,
    employeeId: request.employeeId,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    leaveType: request.leaveType,
    start: dateToDateOnlyString(request.startDate),
    end: dateToDateOnlyString(request.endDate),
    hours: request.hours,
    status: request.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PTO Calendar</h2>
        <p className="text-sm text-slate-600 mt-1">
          Shows approved and pending requests for all employees.
        </p>
      </div>

      <CompanyCalendar events={events} />
    </div>
  );
}
