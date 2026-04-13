function neutralizeCsvFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function csvEscape(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  const safeValue = neutralizeCsvFormula(stringValue);
  return `"${safeValue.replace(/"/g, '""')}"`;
}
