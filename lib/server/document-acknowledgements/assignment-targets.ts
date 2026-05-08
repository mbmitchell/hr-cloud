import { prisma } from "../../db";
import type { AuthorizationActor } from "../authorization";
import {
  assertCanManageDocumentAcknowledgements,
} from "./access";

export type DocumentAssignmentTargetMode =
  | "SINGLE_EMPLOYEE"
  | "MULTI_SELECT"
  | "ALL_ACTIVE"
  | "DEPARTMENT";

export async function resolveAssignmentTargetEmployeeIds(
  actor: AuthorizationActor,
  input: {
    targetMode: string;
    employeeId?: string;
    employeeIds?: string[];
    department?: string;
  }
) {
  assertCanManageDocumentAcknowledgements(actor);

  const targetMode = String(input.targetMode || "").trim();

  if (targetMode === "SINGLE_EMPLOYEE") {
    const employeeId = input.employeeId?.trim() ?? "";
    return employeeId ? [employeeId] : [];
  }

  if (targetMode === "MULTI_SELECT") {
    return Array.from(
      new Set(
        (input.employeeIds ?? []).map((value) => value.trim()).filter(Boolean)
      )
    );
  }

  if (targetMode === "ALL_ACTIVE") {
    const employees = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return employees.map((employee) => employee.id);
  }

  if (targetMode === "DEPARTMENT") {
    const department = input.department?.trim() ?? "";

    if (!department) {
      return [];
    }

    const employees = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        department,
      },
      select: {
        id: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return employees.map((employee) => employee.id);
  }

  throw new Error("Assignment target mode is invalid.");
}
