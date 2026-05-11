import test from "node:test";
import assert from "node:assert/strict";

import {
  isDevAuthEnabled,
  isDevUserSwitcherEnabled,
  parseEnvBoolean,
} from "../lib/auth/dev-auth-flags";

test("parseEnvBoolean only enables exact true values", () => {
  assert.equal(parseEnvBoolean("true"), true);
  assert.equal(parseEnvBoolean(" TRUE "), true);
  assert.equal(parseEnvBoolean("false"), false);
  assert.equal(parseEnvBoolean("0"), false);
  assert.equal(parseEnvBoolean(undefined), false);
});

test("dev auth stays disabled outside local development even if the flag is true", () => {
  assert.equal(
    isDevAuthEnabled({
      NODE_ENV: "production",
      AUTH_ENABLE_DEV_AUTH: "true",
    }),
    false
  );
});

test("dev auth and the switcher require both development mode and explicit flags", () => {
  assert.equal(
    isDevAuthEnabled({
      NODE_ENV: "development",
      AUTH_ENABLE_DEV_AUTH: "true",
    }),
    true
  );

  assert.equal(
    isDevUserSwitcherEnabled({
      NODE_ENV: "development",
      AUTH_ENABLE_DEV_AUTH: "true",
      AUTH_ENABLE_DEV_USER_SWITCHER: "true",
    }),
    true
  );

  assert.equal(
    isDevUserSwitcherEnabled({
      NODE_ENV: "development",
      AUTH_ENABLE_DEV_AUTH: "true",
      AUTH_ENABLE_DEV_USER_SWITCHER: "false",
    }),
    false
  );
});
