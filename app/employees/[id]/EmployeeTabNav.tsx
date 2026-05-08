import Link from "next/link";

export type EmployeeTabItem = {
  id: string;
  label: string;
  href: string;
};

export default function EmployeeTabNav({
  tabs,
  activeTab,
}: {
  tabs: EmployeeTabItem[];
  activeTab: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white p-2 shadow">
      <nav className="flex min-w-max gap-2" aria-label="Employee detail sections">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
