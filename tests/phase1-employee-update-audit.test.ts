import test from "node:test";
import assert from "node:assert/strict";
import type { Employee } from "@prisma/client";

import { applyEmployeeUpdate } from "../lib/server/employees/apply-employee-update";

function createEmployeeUpdateTx() {
  const state = {
    employeeUpdates: [] as unknown[],
    auditCreates: [] as unknown[],
  };

  const updatedEmployee: Employee = {
    id: "emp-1",
    firstName: "Taylor",
    lastName: "Jordan",
    email: "taylor.updated@example.com",
    department: "Operations",
    title: "HR Generalist",
    status: "ACTIVE",
    payType: null,
    hourlyRate: null,
    annualSalary: null,
    fte: 1,
    hireDate: new Date("2024-01-15T00:00:00.000Z"),
    monthlyAccrualOverride: null,
    accrualOverrideReason: null,
    managerId: "mgr-1",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-02-01T00:00:00.000Z"),
  };

  const tx = {
    employee: {
      async update(args: unknown) {
        state.employeeUpdates.push(args);
        return updatedEmployee;
      },
    },
    auditLog: {
      async create(args: unknown) {
        state.auditCreates.push(args);
        return args;
      },
    },
  };

  return { tx, state, updatedEmployee };
}

test("employee update writes an audit log entry with before and after values", async () => {
  const { tx, state, updatedEmployee } = createEmployeeUpdateTx();

  const existingEmployee = {
    ...updatedEmployee,
    email: "taylor.original@example.com",
    title: "HR Coordinator",
  };

  const result = await applyEmployeeUpdate(tx as never, {
    actorId: "admin-1",
    employeeId: "emp-1",
    existingEmployee,
    update: {
      firstName: updatedEmployee.firstName,
      lastName: updatedEmployee.lastName,
      email: updatedEmployee.email,
      department: updatedEmployee.department,
      title: updatedEmployee.title,
      status: updatedEmployee.status,
      hireDate: updatedEmployee.hireDate,
      managerId: updatedEmployee.managerId,
    },
  });

  assert.equal(result.email, "taylor.updated@example.com");
  assert.equal(state.employeeUpdates.length, 1);
  assert.equal(state.auditCreates.length, 1);

  const auditCreate = state.auditCreates[0] as {
    data: {
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      oldValue: string;
      newValue: string;
    };
  };

  assert.equal(auditCreate.data.userId, "admin-1");
  assert.equal(auditCreate.data.action, "EMPLOYEE_UPDATE");
  assert.equal(auditCreate.data.entityType, "Employee");
  assert.equal(auditCreate.data.entityId, "emp-1");

  const oldValue = JSON.parse(auditCreate.data.oldValue);
  const newValue = JSON.parse(auditCreate.data.newValue);

  assert.equal(oldValue.email, "taylor.original@example.com");
  assert.equal(newValue.email, "taylor.updated@example.com");
  assert.equal(oldValue.title, "HR Coordinator");
  assert.equal(newValue.title, "HR Generalist");
});
