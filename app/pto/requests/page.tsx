import { prisma } from "../../../lib/db";
import { auth } from "../../../auth"; // adjust path as needed
import { redirect } from "next/navigation";


const session = await auth();

if (!session?.user) {
  redirect("/login");
}

export default async function PTORequestsPage() {
  const requests = await prisma.pTORequest.findMany({
    include: {
      employee: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">PTO Request History</h2>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Leave Type</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Hours</th>
              <th className="p-3">Status</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t">
                <td className="p-3">
                  {request.employee.firstName} {request.employee.lastName}
                </td>
                <td className="p-3">{request.leaveType}</td>
                <td className="p-3">
                  {new Date(request.startDate).toLocaleDateString()} -{" "}
                  {new Date(request.endDate).toLocaleDateString()}
                </td>
                <td className="p-3">{request.hours}</td>
                <td className="p-3">{request.status}</td>
                <td className="p-3">{request.notes ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}