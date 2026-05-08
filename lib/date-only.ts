function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateOnlyParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(localDate.getTime()) ||
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function parseDateOnly(value: string) {
  const parts = parseDateOnlyParts(value);

  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month - 1, parts.day);
}

export function dateToDateOnlyString(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
    value.getUTCDate()
  )}`;
}

export function normalizeDateOnly(value: string | Date) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dateToDateOnlyString(value);
  }

  const trimmed = value.trim();
  const dateOnly = parseDateOnly(trimmed);

  if (dateOnly) {
    return trimmed;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return dateToDateOnlyString(parsed);
}

export function dateOnlyToLocalDate(value: string | Date) {
  const normalized = normalizeDateOnly(value);

  if (!normalized) {
    return null;
  }

  return parseDateOnly(normalized);
}

export function formatDateOnlyForDisplay(value: string | Date) {
  const localDate = dateOnlyToLocalDate(value);
  return localDate ? localDate.toLocaleDateString() : "";
}
