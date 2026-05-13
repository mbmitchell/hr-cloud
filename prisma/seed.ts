import { PrismaClient } from "@prisma/client";

import { seedFederalCompanyHolidays } from "../lib/company-holidays/service";

const prisma = new PrismaClient();

async function seedPermissions() {
  const permissions = [
    ["VIEW_SELF_PROFILE", "View Self Profile", "employee"],
    ["VIEW_TEAM_PROFILE", "View Team Profile", "employee"],
    ["VIEW_ALL_EMPLOYEES", "View All Employees", "employee"],
    ["EDIT_EMPLOYEE_RECORDS", "Edit Employee Records", "employee"],

    ["CREATE_SELF_REQUEST", "Create Self Request", "requests"],
    ["VIEW_SELF_REQUESTS", "View Self Requests", "requests"],
    ["VIEW_TEAM_REQUESTS", "View Team Requests", "requests"],
    ["VIEW_ALL_REQUESTS", "View All Requests", "requests"],

    ["APPROVE_DIRECT_REPORT_REQUESTS", "Approve Direct Report Requests", "approvals"],
    ["DENY_DIRECT_REPORT_REQUESTS", "Deny Direct Report Requests", "approvals"],
    ["APPROVE_ALL_REQUESTS", "Approve All Requests", "approvals"],
    ["DENY_ALL_REQUESTS", "Deny All Requests", "approvals"],

    ["ADD_COMP_TIME", "Add Comp Time", "adjustments"],
    ["ADJUST_PTO_BALANCE", "Adjust PTO Balance", "adjustments"],
    ["ADJUST_COMP_BALANCE", "Adjust Comp Balance", "adjustments"],
    ["SET_ACCRUAL_OVERRIDE", "Set Accrual Override", "adjustments"],

    ["VIEW_BALANCE_REPORTS", "View Balance Reports", "finance"],
    ["VIEW_LIABILITY_REPORTS", "View Liability Reports", "finance"],
    ["VIEW_FINANCIAL_RATES", "View Financial Rates", "finance"],
    ["EXPORT_FINANCIAL_REPORTS", "Export Financial Reports", "finance"],

    ["MANAGE_USERS", "Manage Users", "system"],
    ["MANAGE_ROLES", "Manage Roles", "system"],
    ["MANAGE_POLICIES", "Manage Policies", "system"],
    ["RUN_MONTHLY_ACCRUALS", "Run Monthly Accruals", "system"],
    ["RUN_YEAR_END_ROLLOVER", "Run Year End Rollover", "system"],

    ["VIEW_AUDIT_LOG", "View Audit Log", "audit"],
    ["EXPORT_AUDIT_LOG", "Export Audit Log", "audit"],
  ];

  for (const [code, name, category] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { name, category },
      create: { code, name, category },
    });
  }
}

async function seedRoles() {
  const roles = [
    ["SITE_ADMIN", "Site Admin"],
    ["HR_ADMIN", "HR Admin"],
    ["ACCOUNTING", "Accounting"],
    ["MANAGER", "Manager"],
    ["EMPLOYEE", "Employee"],
    ["EXECUTIVE_READONLY", "Executive Read Only"],
    ["AUDITOR", "Auditor"],
  ];

  for (const [code, name] of roles) {
    await prisma.role.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }
}

async function assignPermissionsToRoles() {
  const rolePermissions: Record<string, string[]> = {
    SITE_ADMIN: [
      "VIEW_ALL_EMPLOYEES",
      "EDIT_EMPLOYEE_RECORDS",
      "VIEW_ALL_REQUESTS",
      "APPROVE_ALL_REQUESTS",
      "DENY_ALL_REQUESTS",
      "ADJUST_PTO_BALANCE",
      "ADJUST_COMP_BALANCE",
      "ADD_COMP_TIME",
      "SET_ACCRUAL_OVERRIDE",
      "VIEW_BALANCE_REPORTS",
      "VIEW_LIABILITY_REPORTS",
      "VIEW_FINANCIAL_RATES",
      "EXPORT_FINANCIAL_REPORTS",
      "MANAGE_USERS",
      "MANAGE_ROLES",
      "MANAGE_POLICIES",
      "RUN_MONTHLY_ACCRUALS",
      "RUN_YEAR_END_ROLLOVER",
      "VIEW_AUDIT_LOG",
      "EXPORT_AUDIT_LOG",
    ],
    HR_ADMIN: [
      "VIEW_ALL_EMPLOYEES",
      "EDIT_EMPLOYEE_RECORDS",
      "VIEW_ALL_REQUESTS",
      "APPROVE_ALL_REQUESTS",
      "DENY_ALL_REQUESTS",
      "ADJUST_PTO_BALANCE",
      "ADJUST_COMP_BALANCE",
      "ADD_COMP_TIME",
      "SET_ACCRUAL_OVERRIDE",
      "VIEW_BALANCE_REPORTS",
      "VIEW_AUDIT_LOG",
    ],
    ACCOUNTING: [
      "VIEW_BALANCE_REPORTS",
      "VIEW_LIABILITY_REPORTS",
      "VIEW_FINANCIAL_RATES",
      "EXPORT_FINANCIAL_REPORTS",
    ],
    MANAGER: [
      "VIEW_SELF_PROFILE",
      "VIEW_TEAM_PROFILE",
      "CREATE_SELF_REQUEST",
      "VIEW_SELF_REQUESTS",
      "VIEW_TEAM_REQUESTS",
      "APPROVE_DIRECT_REPORT_REQUESTS",
      "DENY_DIRECT_REPORT_REQUESTS",
      "ADD_COMP_TIME",
    ],
    EMPLOYEE: [
      "VIEW_SELF_PROFILE",
      "CREATE_SELF_REQUEST",
      "VIEW_SELF_REQUESTS",
    ],
    EXECUTIVE_READONLY: [
      "VIEW_ALL_EMPLOYEES",
      "VIEW_ALL_REQUESTS",
      "VIEW_BALANCE_REPORTS",
      "VIEW_LIABILITY_REPORTS",
    ],
    AUDITOR: [
      "VIEW_ALL_REQUESTS",
      "VIEW_AUDIT_LOG",
      "EXPORT_AUDIT_LOG",
      "VIEW_BALANCE_REPORTS",
    ],
  };

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;

    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUnique({
        where: { code: permissionCode },
      });
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function assignRole(employeeId: string, roleCode: string) {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new Error(`Role ${roleCode} not found`);

  await prisma.employeeRoleAssignment.create({
    data: {
      employeeId,
      roleId: role.id,
      isActive: true,
    },
  });
}

async function seedBalances(employeeId: string, pto: number, comp: number) {
  await prisma.pTOLedger.create({
    data: {
      employeeId,
      bucket: "PTO",
      type: "ACCRUAL",
      hours: pto,
      balance: pto,
      effectiveDate: new Date(),
      notes: "Initial PTO balance",
    },
  });

  await prisma.pTOLedger.create({
    data: {
      employeeId,
      bucket: "COMP",
      type: "MANUAL_ADD",
      hours: comp,
      balance: comp,
      effectiveDate: new Date(),
      notes: "Initial COMP balance",
    },
  });
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.companyHoliday.deleteMany();
  await prisma.pTOLedger.deleteMany();
  await prisma.pTORequest.deleteMany();
  await prisma.employeeRoleAssignment.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.employee.deleteMany();

  await prisma.policySettings.deleteMany();

await prisma.policySettings.create({
  data: {
    accrualRate0To5: 10,
    accrualRate6To10: 13.33,
    accrualRateOver10: 16.67,
    rolloverCapHours: 80,
  },
});

  await seedFederalCompanyHolidays(
    prisma,
    Number(new Date().getFullYear())
  );

  await seedPermissions();
  await seedRoles();
  await assignPermissionsToRoles();

  const marty = await prisma.employee.create({
    data: {
      email: "marty@mfncuso.com",
    firstName: "Marty",
    lastName: "Mitchell",
    title: "Chief Information Officer",
    department: "IT",
    hireDate: new Date("2017-11-01"),
    status: "ACTIVE",
    payType: "SALARY",
    annualSalary: 165000,
    fte: 1,
    },
  });

  const sarah = await prisma.employee.create({
    data: {
        email: "sarah.manager@mfncuso.com",
    firstName: "Sarah",
    lastName: "Manager",
    title: "Operations Manager",
    department: "Operations",
    hireDate: new Date("2019-04-15"),
    status: "ACTIVE",
    payType: "SALARY",
    annualSalary: 95000,
    fte: 1,
    },
  });

  const andrew = await prisma.employee.create({
    data: {
        email: "andrew.accounting@mfncuso.com",
    firstName: "Andrew",
    lastName: "Accounting",
    title: "Controller",
    department: "Finance",
    hireDate: new Date("2020-01-10"),
    status: "ACTIVE",
    payType: "SALARY",
    annualSalary: 105000,
    fte: 1,
    },
  });

  const allen = await prisma.employee.create({
    data: {
     email: "allen@mfncuso.com",
    firstName: "Allen",
    lastName: "Yoest",
    title: "System Administrator",
    department: "Infrastructure",
    hireDate: new Date("2022-06-13"),
    managerId: sarah.id,
    status: "ACTIVE",
    payType: "HOURLY",
    hourlyRate: 34,
    fte: 1,
    },
  });

  await assignRole(marty.id, "SITE_ADMIN");
  await assignRole(marty.id, "HR_ADMIN");
  await assignRole(marty.id, "ACCOUNTING");

  await assignRole(sarah.id, "MANAGER");
  await assignRole(sarah.id, "EMPLOYEE");

  await assignRole(andrew.id, "ACCOUNTING");
  await assignRole(andrew.id, "EMPLOYEE");

  await assignRole(allen.id, "EMPLOYEE");

  await seedBalances(marty.id, 120, 8);
  await seedBalances(sarah.id, 96, 6);
  await seedBalances(andrew.id, 88, 0);
  await seedBalances(allen.id, 80, 4);

  await prisma.pTORequest.create({
    data: {
      employeeId: allen.id,
      leaveType: "PTO",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-01"),
      hours: 8,
      status: "APPROVED",
      approverId: sarah.id,
      notes: "Seeded PTO request",
    },
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
