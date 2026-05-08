import { timingSafeEqual } from "node:crypto";

export class InternalJobAuthError extends Error {
  readonly status = 403;

  constructor(message = "Forbidden.") {
    super(message);
    this.name = "InternalJobAuthError";
  }
}

function isLoopbackValue(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1"
  );
}

function assertLoopbackRequestWhenDetectable(request: Request) {
  const candidates = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    new URL(request.url).hostname,
  ]
    .flatMap((value) => (value ? value.split(",") : []))
    .map((value) => value.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return;
  }

  if (candidates.some(isLoopbackValue)) {
    return;
  }

  throw new InternalJobAuthError("Internal job requests must originate from localhost.");
}

function getExpectedInternalJobSecret() {
  const value = process.env.INTERNAL_JOB_SECRET?.trim();

  if (!value) {
    throw new InternalJobAuthError("Internal job authentication is not configured.");
  }

  return value;
}

function getProvidedInternalJobSecret(request: Request) {
  const value = request.headers.get("X-INTERNAL-JOB-KEY")?.trim();

  if (!value) {
    throw new InternalJobAuthError("Missing internal job credentials.");
  }

  return value;
}

function safeSecretsMatch(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isInternalJobAuthError(
  error: unknown
): error is InternalJobAuthError {
  return error instanceof InternalJobAuthError;
}

export function assertInternalJobAuth(request: Request) {
  assertLoopbackRequestWhenDetectable(request);

  const expected = getExpectedInternalJobSecret();
  const provided = getProvidedInternalJobSecret(request);

  if (!safeSecretsMatch(expected, provided)) {
    throw new InternalJobAuthError("Invalid internal job credentials.");
  }
}
