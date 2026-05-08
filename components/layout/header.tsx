import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles } from "../../lib/auth/permissions";
import { prisma } from "../../lib/db";
import DevUserSwitcher from "../dev/dev-user-switcher";
import { auth, signOut } from "../../auth";
import Link from "next/link";

export default async function Header() {
  const session = await auth();
  const user = await getCurrentUser();
  const roles = user ? await getEmployeeRoles(user.id) : [];
  const isDev = process.env.NODE_ENV !== "production";
  const allowDevUserSwitcher =
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_ENABLE_DEV_AUTH === "true" &&
    process.env.AUTH_ENABLE_DEV_USER_SWITCHER === "true";

  const employees = isDev && allowDevUserSwitcher
    ? await prisma.employee.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  return (
    <div className="bg-white border-b p-4 flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
      <div>
        <h1 className="text-lg font-semibold">Managed Financial Networks HR</h1>

        <div className="text-sm text-gray-600 text-left mt-1">
          <div>
            {user
              ? `${user.firstName} ${user.lastName}`
              : session?.user?.email || "Not signed in"}
          </div>
          <div className="text-xs text-slate-500">
            {roles.length ? roles.join(", ") : "No roles"}
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 space-y-3">
        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 text-sm"
            >
              Sign Out
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="inline-block border border-slate-300 px-4 py-2 rounded hover:bg-slate-50 text-sm"
          >
            Sign In
          </Link>
        )}

        {isDev && allowDevUserSwitcher && session?.user && (
          <DevUserSwitcher
            employees={employees}
            currentUserId={user?.id ?? null}
          />
        )}
      </div>
    </div>
  );
}
