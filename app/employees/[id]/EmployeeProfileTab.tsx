import Link from "next/link";

import EmployeeEmergencyContactsCard from "./EmployeeEmergencyContactsCard";
import EmployeePrivateContactInfoCard from "./EmployeePrivateContactInfoCard";
import EmployeeProfileSection from "./EmployeeProfileSection";

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString();
}

export default function EmployeeProfileTab({
  employeeId,
  employee,
  directReports,
  roleCodes,
  contactInfo,
  emergencyContacts,
  canViewPrivateInfo,
}: {
  employeeId: string;
  employee: {
    email: string;
    status: string;
    department: string | null;
    title: string | null;
    hireDate: Date;
    manager: {
      firstName: string;
      lastName: string;
    } | null;
  };
  directReports: Array<{
    id: string;
    firstName: string;
    lastName: string;
    title: string | null;
    department: string | null;
  }>;
  roleCodes: string[];
  contactInfo: {
    preferredName: string | null;
    personalEmail: string | null;
    mobilePhone: string | null;
    homePhone: string | null;
    street1: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
  emergencyContacts: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email: string | null;
    priority: number;
  }>;
  canViewPrivateInfo: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <EmployeeProfileSection title="Employment" defaultExpanded>
          <div className="space-y-2 text-sm">
            <div>
              <b>Email:</b> {employee.email}
            </div>
            <div>
              <b>Status:</b> {employee.status}
            </div>
            <div>
              <b>Department:</b> {employee.department ?? "-"}
            </div>
            <div>
              <b>Title:</b> {employee.title ?? "-"}
            </div>
            <div>
              <b>Hire Date:</b> {formatDate(employee.hireDate)}
            </div>
          </div>
        </EmployeeProfileSection>

        <EmployeeProfileSection title="Reporting" defaultExpanded>
          <div className="space-y-2 text-sm">
            <div>
              <b>Manager:</b>{" "}
              {employee.manager
                ? `${employee.manager.firstName} ${employee.manager.lastName}`
                : "-"}
            </div>
            {directReports.length > 0 && (
              <div className="pt-2">
                <div className="font-semibold text-slate-900">Direct Reports</div>
                <div className="mt-2 space-y-2">
                  {directReports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/employees/${report.id}`}
                      className="block rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="font-medium text-slate-900 hover:text-blue-600">
                        {report.firstName} {report.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {report.title ?? "No title"}
                        {report.department ? ` • ${report.department}` : ""}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </EmployeeProfileSection>

        <EmployeeProfileSection title="Organization" defaultExpanded>
          <div className="space-y-2 text-sm">
            <div>
              <b>Roles:</b> {roleCodes.length ? roleCodes.join(", ") : "-"}
            </div>
          </div>
        </EmployeeProfileSection>
      </div>

      {canViewPrivateInfo ? (
        <>
          <EmployeePrivateContactInfoCard
            employeeId={employeeId}
            contactInfo={contactInfo}
            canEdit={canViewPrivateInfo}
          />

          <EmployeeEmergencyContactsCard
            employeeId={employeeId}
            contacts={emergencyContacts}
            canEdit={canViewPrivateInfo}
          />
        </>
      ) : null}
    </div>
  );
}
