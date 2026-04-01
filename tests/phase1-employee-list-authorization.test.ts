import test from "node:test";
import assert from "node:assert/strict";

import { filterEmployeesByVisibleIds } from "../lib/server/employee-visibility";

test("employee list filtering excludes unauthorized employees", () => {
  const employees = [
    { id: "emp-1", firstName: "Taylor" },
    { id: "emp-2", firstName: "Jordan" },
    { id: "emp-3", firstName: "Alex" },
  ];

  const visibleEmployees = filterEmployeesByVisibleIds(employees, [
    "emp-1",
    "emp-3",
  ]);

  assert.deepEqual(
    visibleEmployees.map((employee) => employee.id),
    ["emp-1", "emp-3"]
  );
});
