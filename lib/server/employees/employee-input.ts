type EmployeeInputParseOptions = {
  normalizeEmail?: boolean;
  includeCompensation?: boolean;
};

export type ParsedEmployeeInput = {
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  title: string | null;
  status: string;
  hireDate: Date;
  managerId: string | null;
  payType?: string | null;
  hourlyRate?: number | null;
  annualSalary?: number | null;
  fte?: number;
};

type EmployeeInputParseResult =
  | {
      ok: true;
      data: ParsedEmployeeInput;
    }
  | {
      ok: false;
      error: string;
    };

function parseOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function parseRequiredString(value: unknown) {
  return String(value || "").trim();
}

export function parseEmployeeInput(
  body: Record<string, unknown>,
  options: EmployeeInputParseOptions = {}
): EmployeeInputParseResult {
  const firstName = parseRequiredString(body.firstName);
  const lastName = parseRequiredString(body.lastName);
  const rawEmail = parseRequiredString(body.email);
  const email = options.normalizeEmail ? rawEmail.toLowerCase() : rawEmail;
  const department = parseOptionalString(body.department);
  const title = parseOptionalString(body.title);
  const status = parseRequiredString(body.status);
  const hireDate = parseRequiredString(body.hireDate);
  const managerId = parseOptionalString(body.managerId);

  if (!firstName || !lastName || !email || !status || !hireDate) {
    return {
      ok: false,
      error: "First name, last name, email, status, and hire date are required.",
    };
  }

  const parsedHireDate = new Date(hireDate);
  if (Number.isNaN(parsedHireDate.getTime())) {
    return {
      ok: false,
      error: "Hire date is invalid.",
    };
  }

  const parsed: ParsedEmployeeInput = {
    firstName,
    lastName,
    email,
    department,
    title,
    status,
    hireDate: parsedHireDate,
    managerId,
  };

  if (!options.includeCompensation) {
    return {
      ok: true,
      data: parsed,
    };
  }

  const payType = parseOptionalString(body.payType);
  const hourlyRate =
    body.hourlyRate == null || body.hourlyRate === ""
      ? null
      : Number(body.hourlyRate);
  const annualSalary =
    body.annualSalary == null || body.annualSalary === ""
      ? null
      : Number(body.annualSalary);
  const fte =
    body.fte == null || body.fte === "" ? 1 : Number(body.fte);

  if (payType && !["HOURLY", "SALARY"].includes(payType)) {
    return {
      ok: false,
      error: "Invalid pay type.",
    };
  }

  if (hourlyRate != null && (Number.isNaN(hourlyRate) || hourlyRate < 0)) {
    return {
      ok: false,
      error: "Hourly rate must be zero or greater.",
    };
  }

  if (annualSalary != null && (Number.isNaN(annualSalary) || annualSalary < 0)) {
    return {
      ok: false,
      error: "Annual salary must be zero or greater.",
    };
  }

  if (Number.isNaN(fte) || fte <= 0) {
    return {
      ok: false,
      error: "FTE must be greater than zero.",
    };
  }

  if (payType === "HOURLY" && hourlyRate == null) {
    return {
      ok: false,
      error: "Hourly employees require an hourly rate.",
    };
  }

  if (payType === "SALARY" && annualSalary == null) {
    return {
      ok: false,
      error: "Salary employees require an annual salary.",
    };
  }

  return {
    ok: true,
    data: {
      ...parsed,
      payType,
      hourlyRate,
      annualSalary,
      fte,
    },
  };
}
