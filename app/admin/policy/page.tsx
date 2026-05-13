import Link from "next/link";

import { currentUserHasAnyRole } from "../../../lib/auth/access";
import { AccrualOverrideClientContent } from "../accrual-override/AccrualOverrideClient";
import { PolicyAdminClientContent } from "./PolicyAdminClient";

export default async function PolicyAdminPage() {
  const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to PTO settings.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">PTO Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage PTO policy rules and employee-specific accrual settings from one place.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Policy Settings</h2>
          <p className="text-sm text-slate-600">
            Configure default accrual tiers and the year-end rollover cap.
          </p>
        </div>
        <PolicyAdminClientContent showHeader={false} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Holiday Calendar</h2>
          <p className="text-sm text-slate-600">
            Manage company holidays that should be excluded from PTO calculations.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <Link
            href="/admin/holidays"
            className="inline-flex rounded bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open Company Holidays
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Accrual Settings</h2>
          <p className="text-sm text-slate-600">
            Manage employee-specific accrual modes, advanced tiers, and manual overrides.
          </p>
        </div>
        <AccrualOverrideClientContent showHeader={false} />
      </section>
    </div>
  );
}
