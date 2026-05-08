import test from "node:test";
import assert from "node:assert/strict";

async function importSwitchUserRoute() {
  return import(
    `../app/api/dev/switch-user/route.ts?test=${Date.now()}-${Math.random()}`
  );
}

test("dev switch-user route is disabled when AUTH_ENABLE_DEV_AUTH is not true", async () => {
  const previous = process.env.AUTH_ENABLE_DEV_AUTH;
  const previousSwitcher = process.env.AUTH_ENABLE_DEV_USER_SWITCHER;
  process.env.AUTH_ENABLE_DEV_AUTH = "false";
  process.env.AUTH_ENABLE_DEV_USER_SWITCHER = "false";

  try {
    const route = await importSwitchUserRoute();
    const response = await route.POST(
      new Request("http://localhost/api/dev/switch-user", {
        method: "POST",
        body: JSON.stringify({ employeeId: "emp-1" }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Dev switcher is disabled.");
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_ENABLE_DEV_AUTH;
    } else {
      process.env.AUTH_ENABLE_DEV_AUTH = previous;
    }

    if (previousSwitcher === undefined) {
      delete process.env.AUTH_ENABLE_DEV_USER_SWITCHER;
    } else {
      process.env.AUTH_ENABLE_DEV_USER_SWITCHER = previousSwitcher;
    }
  }
});

test("dev switch-user route can set the impersonation cookie only in explicit dev mode", async () => {
  const previous = process.env.AUTH_ENABLE_DEV_AUTH;
  const previousSwitcher = process.env.AUTH_ENABLE_DEV_USER_SWITCHER;
  process.env.AUTH_ENABLE_DEV_AUTH = "true";
  process.env.AUTH_ENABLE_DEV_USER_SWITCHER = "true";

  try {
    const route = await importSwitchUserRoute();
    const response = await route.POST(
      new Request("http://localhost/api/dev/switch-user", {
        method: "POST",
        body: JSON.stringify({ employeeId: "emp-1" }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") ?? "", /dev_employee_id=emp-1/);
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_ENABLE_DEV_AUTH;
    } else {
      process.env.AUTH_ENABLE_DEV_AUTH = previous;
    }

    if (previousSwitcher === undefined) {
      delete process.env.AUTH_ENABLE_DEV_USER_SWITCHER;
    } else {
      process.env.AUTH_ENABLE_DEV_USER_SWITCHER = previousSwitcher;
    }
  }
});

test("dev switch-user route is disabled when the dedicated switcher flag is off", async () => {
  const previous = process.env.AUTH_ENABLE_DEV_AUTH;
  const previousSwitcher = process.env.AUTH_ENABLE_DEV_USER_SWITCHER;
  process.env.AUTH_ENABLE_DEV_AUTH = "true";
  process.env.AUTH_ENABLE_DEV_USER_SWITCHER = "false";

  try {
    const route = await importSwitchUserRoute();
    const response = await route.POST(
      new Request("http://localhost/api/dev/switch-user", {
        method: "POST",
        body: JSON.stringify({ employeeId: "emp-1" }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Dev switcher is disabled.");
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_ENABLE_DEV_AUTH;
    } else {
      process.env.AUTH_ENABLE_DEV_AUTH = previous;
    }

    if (previousSwitcher === undefined) {
      delete process.env.AUTH_ENABLE_DEV_USER_SWITCHER;
    } else {
      process.env.AUTH_ENABLE_DEV_USER_SWITCHER = previousSwitcher;
    }
  }
});
