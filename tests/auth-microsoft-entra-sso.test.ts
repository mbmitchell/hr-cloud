import test from "node:test";
import assert from "node:assert/strict";

import { authorizeMicrosoftEntraSignIn } from "../lib/auth/microsoft-entra-sso";

test("entra sign-in is allowed only when the authenticated email matches an employee", async () => {
  const resolveEmployeeByEmail = async (email: string) => {
    if (email === "employee@example.com") {
      return {
        id: "emp-1",
        email: "employee@example.com",
        firstName: "Taylor",
        lastName: "Jordan",
      };
    }

    return null;
  };

  const allowedUser = await authorizeMicrosoftEntraSignIn({
    user: { email: "employee@example.com" },
    profile: null,
    resolveEmployeeByEmail,
  });

  assert.deepEqual(allowedUser, {
    id: "emp-1",
    email: "employee@example.com",
    name: "Taylor Jordan",
  });

  const deniedUser = await authorizeMicrosoftEntraSignIn({
    user: { email: "missing@example.com" },
    profile: null,
    resolveEmployeeByEmail,
  });

  assert.equal(deniedUser, null);
});
