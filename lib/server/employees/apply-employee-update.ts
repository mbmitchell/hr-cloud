import type { Employee, Prisma } from "@prisma/client";

import { writeAuditLog } from "../audit/write-audit-log";

type EmployeeUpdateInput = {
  actorId: string;
  employeeId: string;
  existingEmployee: Employee;
  update: {
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    title: string | null;
    status: string;
    hireDate: Date;
    managerId: string | null;
  };
};

function serializeEmployee(employee: {
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  title: string | null;
  status: string;
  hireDate: Date;
  managerId: string | null;
}) {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    department: employee.department,
    title: employee.title,
    status: employee.status,
    hireDate: employee.hireDate.toISOString(),
    managerId: employee.managerId,
  };
}

export async function applyEmployeeUpdate(
  tx: Prisma.TransactionClient,
  input: EmployeeUpdateInput
) {
  const updated = await tx.employee.update({
    where: { id: input.employeeId },
    data: input.update,
  });

  await writeAuditLog(tx, {
    userId: input.actorId,
    action: "EMPLOYEE_UPDATE",
    entityType: "Employee",
    entityId: updated.id,
    oldValue: serializeEmployee(input.existingEmployee),
    newValue: serializeEmployee(updated),
  });

  return updated;
}
