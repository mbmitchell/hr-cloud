import { NextResponse } from "next/server";

import { requireRoleWithTenantContext } from "../../../../../lib/server/tenant-context-route";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import { isAuthorizationError } from "../../../../../lib/server/authorization";
import {
  getEmployeeMasterExportParityDiagnostics,
  getEmployeeMasterFilters,
} from "../../../../../lib/server/reports/employee-master";

export async function GET(request: Request) {
  try {
    const { tenantContext } = await requireRoleWithTenantContext(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "REPORT_EMPLOYEE_MASTER_EXPORT_PARITY_VIEW",
        entityType: "Report",
        entityId: "employee-master-export-parity",
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

    const parity = await getEmployeeMasterExportParityDiagnostics({
      filters,
      tenantContext,
    });

    return NextResponse.json(
      {
        mode: "export_parity_compare",
        parity,
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
      { error: "Failed to load employee master export parity diagnostics." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}
