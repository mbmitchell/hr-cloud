type DevAuthEnv = Record<string, string | undefined>;

export function parseEnvBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isDevelopmentEnvironment(
  env: DevAuthEnv = process.env
): boolean {
  return env.NODE_ENV === "development";
}

export function isDevAuthFlagEnabled(env: DevAuthEnv = process.env): boolean {
  return parseEnvBoolean(env.AUTH_ENABLE_DEV_AUTH);
}

export function isDevUserSwitcherFlagEnabled(
  env: DevAuthEnv = process.env
): boolean {
  return parseEnvBoolean(env.AUTH_ENABLE_DEV_USER_SWITCHER);
}

export function isDevAuthEnabled(env: DevAuthEnv = process.env): boolean {
  return isDevelopmentEnvironment(env) && isDevAuthFlagEnabled(env);
}

export function isDevUserSwitcherEnabled(
  env: DevAuthEnv = process.env
): boolean {
  return isDevAuthEnabled(env) && isDevUserSwitcherFlagEnabled(env);
}
