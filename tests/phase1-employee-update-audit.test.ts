import test from "node:test";
import assert from "node:assert/strict";
import type { Employee } from "@prisma/client";

import { applyEmployeeUpdate } from "../lib/server/employees/apply-employee-update";

function createEmployeeUpdateTx() {
  const state = {
    employeeUpdates: [] as unknown[],
    statusHistoryCreates: [] as unknown[],
    auditCreates: [] as unknown[],
  };

  const updatedEmployee: Employee = {
    id: "emp-1",
    firstName: "Taylor",
    lastName: "Jordan",
    email: "taylor.updated@example.com",
    entraOid: null,
    entraTid: null,
    department: "Operations",
    title: "HR Generalist",
    status: "ACTIVE",
    employmentClassification: null,
    workLocation: null,
    payType: null,
    hourlyRate: null,
    annualSalary: null,
    fte: 1,
    payrollFrequency: "BIWEEKLY",
    hireDate: new Date("2024-01-15T00:00:00.000Z"),
    accrualMode: "STANDARD_TENURE",
    monthlyAccrualOverride: null,
    accrualOverrideReason: null,
    advancedAccrualTier: null,
    advancedAccrualEffectiveDate: null,
    advancedAccrualReason: null,
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
    employeeStatusHistory: {
      async create(args: unknown) {
        state.statusHistoryCreates.push(args);
        return args;
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
      payrollFrequency: updatedEmployee.payrollFrequency,
    },
  });

  assert.equal(result.email, "taylor.updated@example.com");
  assert.equal(state.employeeUpdates.length, 1);
  assert.equal(state.statusHistoryCreates.length, 0);
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

test("employee update writes status history only when the status changes", async () => {
  const { tx, state, updatedEmployee } = createEmployeeUpdateTx();

  const existingEmployee = {
    ...updatedEmployee,
    status: "INACTIVE",
  };

  await applyEmployeeUpdate(tx as never, {
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
      payrollFrequency: updatedEmployee.payrollFrequency,
    },
  });

  assert.equal(state.statusHistoryCreates.length, 1);

  const statusHistoryCreate = state.statusHistoryCreates[0] as {
    data: {
      employeeId: string;
      previousStatus: string;
      newStatus: string;
      changedByEmployeeId: string;
    };
  };

  assert.equal(statusHistoryCreate.data.employeeId, "emp-1");
  assert.equal(statusHistoryCreate.data.previousStatus, "INACTIVE");
  assert.equal(statusHistoryCreate.data.newStatus, "ACTIVE");
  assert.equal(statusHistoryCreate.data.changedByEmployeeId, "admin-1");
});
