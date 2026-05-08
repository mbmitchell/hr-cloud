import type { Employee } from "@prisma/client";

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
    payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
  };
};

type EmployeeUpdateTx = {
  employee: {
    update(args: {
      where: { id: string };
      data: EmployeeUpdateInput["update"];
    }): Promise<Employee>;
  };
  auditLog: {
    create(args: {
      data: {
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        oldValue: string | null;
        newValue: string | null;
      };
    }): Promise<unknown>;
  };
};

type EmployeeStatusHistoryWriter = {
  employeeStatusHistory: {
    create(args: {
      data: {
        employeeId: string;
        previousStatus: string;
        newStatus: string;
        changedByEmployeeId: string;
      };
    }): Promise<unknown>;
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
  payrollFrequency: "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
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
    payrollFrequency: employee.payrollFrequency,
  };
}

export async function applyEmployeeUpdate(
  tx: EmployeeUpdateTx,
  input: EmployeeUpdateInput
) {
  const updated = await tx.employee.update({
    where: { id: input.employeeId },
    data: input.update,
  });

  if (input.existingEmployee.status !== updated.status) {
    await (tx as EmployeeUpdateTx & EmployeeStatusHistoryWriter).employeeStatusHistory.create({
      data: {
        employeeId: updated.id,
        previousStatus: input.existingEmployee.status,
        newStatus: updated.status,
        changedByEmployeeId: input.actorId,
      },
    });
  }

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
