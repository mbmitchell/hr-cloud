type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  count: number;
};

const buckets = new Map<string, RateLimitBucket>();

function now() {
  return Date.now();
}

function getOrCreateBucket(key: string, options: RateLimitOptions) {
  const existing = buckets.get(key);
  const timestamp = now();

  if (!existing || existing.resetAt <= timestamp) {
    const freshBucket = {
      count: 0,
      resetAt: timestamp + options.windowMs,
    };
    buckets.set(key, freshBucket);
    return freshBucket;
  }

  return existing;
}

export function consumeAuthRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const bucket = getOrCreateBucket(key, options);
  bucket.count += 1;
  buckets.set(key, bucket);

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - now()) / 1000)
  );
  const allowed = bucket.count <= options.limit;

  return {
    allowed,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds,
    count: bucket.count,
  };
}

export function resetAuthRateLimits(keys: string[]) {
  for (const key of keys) {
    buckets.delete(key);
  }
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function getClientIpFromRequest(request: Request) {
  return getClientIpFromHeaders(request.headers);
}

export function buildCredentialsRateLimitKeys(input: {
  clientIp: string;
  normalizedEmail: string | null;
}) {
  const emailKey = input.normalizedEmail ?? "unknown";

  return [
    `auth:credentials:ip:${input.clientIp}`,
    `auth:credentials:ip-email:${input.clientIp}:${emailKey}`,
  ];
}

export function isMicrosoftEntraRoutePath(pathname: string) {
  return (
    pathname.includes("/api/auth/signin/microsoft-entra-id") ||
    pathname.includes("/api/auth/callback/microsoft-entra-id")
  );
}

export function isCredentialsCallbackRoutePath(pathname: string) {
  return pathname.includes("/api/auth/callback/credentials");
}

export function clearAuthRateLimitStateForTests() {
  buckets.clear();
}

export const AUTH_RATE_LIMITS = {
  // App-layer throttling complements NGINX/Fail2Ban by slowing hot loops
  // at the application boundary, even for requests that reach Next.js.
  credentialsByIp: {
    limit: 15,
    windowMs: 15 * 60 * 1000,
  },
  credentialsByIpAndEmail: {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  },
  microsoftRouteByIp: {
    limit: 20,
    windowMs: 5 * 60 * 1000,
  },
} as const;
