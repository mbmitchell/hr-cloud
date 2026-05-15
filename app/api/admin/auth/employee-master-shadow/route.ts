import { NextResponse } from "next/server";

import { requireRoleWithTenantContext } from "../../../../../lib/server/tenant-context-route";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { isAuthorizationError } from "../../../../../lib/server/authorization";
import {
  getEmployeeMasterFilters,
  getEmployeeMasterReportTenantShadowCompare,
} from "../../../../../lib/server/reports/employee-master";

export async function GET(request: Request) {
  try {
    const { tenantContext } = await requireRoleWithTenantContext(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "REPORT_EMPLOYEE_MASTER_TENANT_SHADOW_VIEW",
        entityType: "Report",
        entityId: "employee-master-shadow",
      }
    );

    const url = new URL(request.url);
    const filters = getEmployeeMasterFilters({
      status: url.searchParams.get("status") ?? undefined,
      department: url.searchParams.get("department") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      manager: url.searchParams.get("manager") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      employmentClassification:
        url.searchParams.get("employmentClassification") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      page: "1",
      pageSize: "10000",
    });

    const shadowCompare = await getEmployeeMasterReportTenantShadowCompare({
      filters,
      tenantContext,
    });

    return NextResponse.json(
      {
        mode: "shadow_compare",
        shadowCompare,
        tenantContext,
      },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to load employee master tenant shadow compare." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
