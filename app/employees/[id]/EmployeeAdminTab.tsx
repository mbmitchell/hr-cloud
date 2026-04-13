import EmployeeEditForm from "./EmployeeEditForm";
import EmployeeRolePanel from "./EmployeeRolePanel";

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
  };
  managers: ManagerOption[];
  roles: RoleOption[];
  assignedRoleCodes: string[];
}) {
  return (
    <div className="space-y-6">
      <EmployeeEditForm
        employee={employee}
        managers={managers}
        defaultExpanded
      />

      <EmployeeRolePanel
        employeeId={employee.id}
        roles={roles}
        assignedRoleCodes={assignedRoleCodes}
        defaultExpanded
      />
    </div>
  );
}
