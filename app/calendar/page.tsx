import { auth } from "../../auth";
import { redirect } from "next/navigation";
import CompanyCalendar from "../../components/calendar/company-calendar";
import { prisma } from "../../lib/db";
import { dateToDateOnlyString } from "../../lib/date-only";
import { buildCompanyCalendarEventId } from "../../lib/calendar/company-event-id";

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
  const holidays = await prisma.companyHoliday.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ date: "asc" }, { name: "asc" }],
  });

  const events = [
    ...requests.map((request) => ({
      id: buildCompanyCalendarEventId("PTO", request.id),
      sourceId: request.id,
      eventType: "PTO" as const,
      employeeId: request.employeeId,
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      title: `${request.employee.firstName} ${request.employee.lastName} • ${request.leaveType}`,
      leaveType: request.leaveType,
      start: dateToDateOnlyString(request.startDate),
      end: dateToDateOnlyString(request.endDate),
      hours: request.hours,
      status: request.status,
      notes: request.notes ?? "",
    })),
    ...holidays.map((holiday) => {
      const dateOnly = dateToDateOnlyString(holiday.date);

      return {
        id: buildCompanyCalendarEventId("HOLIDAY", holiday.id),
        sourceId: holiday.id,
        eventType: "HOLIDAY" as const,
        title: `Holiday - ${holiday.name}`,
        holidayName: holiday.name,
        start: dateOnly,
        end: dateOnly,
        status: "ACTIVE",
        notes: holiday.notes ?? "",
      };
    }),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PTO Calendar</h2>
        <p className="text-sm text-slate-600 mt-1">
          Shows approved and pending requests alongside configured company holidays.
        </p>
      </div>

      <CompanyCalendar events={events} />
    </div>
  );
}
