import type {
  EmployeeContactInfo,
  EmployeeEmergencyContact,
} from "@prisma/client";

type PrivateInfoActor = {
  id: string;
  roles: string[];
};

function normalizeOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function validateOptionalEmail(value: string | null, fieldLabel: string) {
  if (value == null) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return normalized;
}

export function canActorManagePrivateEmployeeInfo(
  actor: PrivateInfoActor,
  employeeId: string
) {
  return (
    actor.id === employeeId ||
    actor.roles.includes("SITE_ADMIN") ||
    actor.roles.includes("HR_ADMIN")
  );
}

export function assertCanManagePrivateEmployeeInfo(
  actor: PrivateInfoActor,
  employeeId: string
) {
  if (!canActorManagePrivateEmployeeInfo(actor, employeeId)) {
    throw new Error("FORBIDDEN_PRIVATE_EMPLOYEE_INFO");
  }
}

export function parseEmployeeContactInfoInput(body: Record<string, unknown>) {
  const preferredName = normalizeOptionalString(body.preferredName);
  const personalEmail = validateOptionalEmail(
    normalizeOptionalString(body.personalEmail),
    "Personal email"
  );
  const mobilePhone = normalizeOptionalString(body.mobilePhone);
  const homePhone = normalizeOptionalString(body.homePhone);
  const street1 = normalizeOptionalString(body.street1);
  const street2 = normalizeOptionalString(body.street2);
  const city = normalizeOptionalString(body.city);
  const state = normalizeOptionalString(body.state);
  const postalCode = normalizeOptionalString(body.postalCode);

  return {
    preferredName,
    personalEmail,
    mobilePhone,
    homePhone,
    street1,
    street2,
    city,
    state,
    postalCode,
  };
}

export function serializeEmployeeContactInfo(
  contactInfo: EmployeeContactInfo | null | undefined
) {
  if (!contactInfo) {
    return null;
  }

  return {
    preferredName: contactInfo.preferredName,
    personalEmail: contactInfo.personalEmail,
    mobilePhone: contactInfo.mobilePhone,
    homePhone: contactInfo.homePhone,
    street1: contactInfo.street1,
    street2: contactInfo.street2,
    city: contactInfo.city,
    state: contactInfo.state,
    postalCode: contactInfo.postalCode,
  };
}

export function parseEmployeeEmergencyContactInput(body: Record<string, unknown>) {
  const name = normalizeOptionalString(body.name);
  const relationship = normalizeOptionalString(body.relationship);
  const phone = normalizeOptionalString(body.phone);
  const email = validateOptionalEmail(
    normalizeOptionalString(body.email),
    "Emergency contact email"
  );
  const priorityValue =
    body.priority == null || body.priority === ""
      ? 1
      : Number(body.priority);

  if (!name) {
    throw new Error("Emergency contact name is required.");
  }

  if (!relationship) {
    throw new Error("Emergency contact relationship is required.");
  }

  if (!phone) {
    throw new Error("Emergency contact phone is required.");
  }

  if (!Number.isInteger(priorityValue) || priorityValue < 1) {
    throw new Error("Emergency contact priority must be a whole number of 1 or greater.");
  }

  return {
    name,
    relationship,
    phone,
    email,
    priority: priorityValue,
  };
}

export function serializeEmployeeEmergencyContact(
  contact: EmployeeEmergencyContact
) {
  return {
    id: contact.id,
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    email: contact.email,
    priority: contact.priority,
  };
}
