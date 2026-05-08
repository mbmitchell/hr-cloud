import test from "node:test";
import assert from "node:assert/strict";

import {
  canActorCreateRequestFor,
  canActorViewEmployee,
} from "../lib/server/authorization";

test("plain employee cannot view another employee without elevated access", () => {
  const allowed = canActorViewEmployee({
    actorId: "emp-1",
    employeeId: "emp-2",
    actorRoles: ["EMPLOYEE"],
    actorPermissions: [],
    isManagerOfTarget: false,
  });

  assert.equal(allowed, false);
});

test("employee can view their own record", () => {
  const allowed = canActorViewEmployee({
    actorId: "emp-1",
    employeeId: "emp-1",
    actorRoles: ["EMPLOYEE"],
    actorPermissions: [],
    isManagerOfTarget: false,
  });

  assert.equal(allowed, true);
});

test("manager-like permission allows viewing a team member", () => {
  const allowed = canActorViewEmployee({
    actorId: "mgr-1",
    employeeId: "emp-2",
    actorRoles: ["MANAGER"],
    actorPermissions: ["VIEW_TEAM_PROFILE"],
    isManagerOfTarget: true,
  });

  assert.equal(allowed, true);
});

test("plain employee cannot submit PTO for someone else", () => {
  const allowed = canActorCreateRequestFor({
    actorId: "emp-1",
    employeeId: "emp-2",
    actorRoles: ["EMPLOYEE"],
  });

  assert.equal(allowed, false);
});

test("site admin can submit PTO for another employee", () => {
  const allowed = canActorCreateRequestFor({
    actorId: "admin-1",
    employeeId: "emp-2",
    actorRoles: ["SITE_ADMIN"],
  });

  assert.equal(allowed, true);
});
