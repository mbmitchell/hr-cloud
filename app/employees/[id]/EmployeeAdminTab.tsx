import EmployeeCompensationPanel from "./EmployeeCompensationPanel";
import EmployeeEditForm from "./EmployeeEditForm";
import EmployeeIdentityDiagnosticsPanel from "./EmployeeIdentityDiagnosticsPanel";
import EmployeeRolePanel from "./EmployeeRolePanel";
import EmployeeTotalCompensationSummaryCard from "./EmployeeTotalCompensationSummaryCard";

type ManagerOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type RoleOption = {
  id: string;
  code: string;
  name: string;
};

export default function EmployeeAdminTab({
  employee,
  managers,
  roles,
  assignedRoleCodes,
}: {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    title: string | null;
    status: string;
    hireDate: string;
    managerId: string | null;
    payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
    compensationProfile: {
      employeeId: string;
      payType: "SALARY" | "HOURLY" | null;
      annualSalary: string | null;
      hourlyRate: string | null;
      standardHours: string;
      payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
      effectiveDate: string;
      notes: string | null;
      hasProfile: boolean;
    };
    totalCompensationSummary: {
      baseCompensationAnnual: string | null;
      employerMonthlyBenefitCost: string;
      employerAnnualBenefitCost: string;
      estimatedTotalAnnualCompensation: string | null;
    };
  };
  managers: ManagerOption[];
  roles: RoleOption[];
  assignedRoleCodes: string[];
}) {
  return (
    <div className="space-y-6">
      <EmployeeTotalCompensationSummaryCard
        summary={employee.totalCompensationSummary}
        payType={employee.compensationProfile.payType}
      />

      <EmployeeEditForm
        employee={employee}
        managers={managers}
        defaultExpanded
      />

      <EmployeeCompensationPanel
        profile={employee.compensationProfile}
        defaultExpanded
      />

      <EmployeeRolePanel
        employeeId={employee.id}
        roles={roles}
        assignedRoleCodes={assignedRoleCodes}
        defaultExpanded
      />

      <EmployeeIdentityDiagnosticsPanel
        employeeId={employee.id}
        defaultExpanded
      />
    </div>
  );
}
