"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  SidebarIconName,
  SidebarNavItem,
  SidebarNavSection,
} from "./sidebar-nav";

const SIDEBAR_COLLAPSED_KEY = "mfn-hr-sidebar-collapsed";
const SIDEBAR_SECTION_STATE_KEY = "mfn-hr-sidebar-sections";

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildDefaultOpenSections(
  sections: SidebarNavSection[],
  pathname: string
) {
  return Object.fromEntries(
    sections.map((section) => [
      section.id,
      section.items.some((item) => isItemActive(pathname, item.href)) ||
        section.id === "home" ||
        section.id === "my-time",
    ])
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M7 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PanelToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d={collapsed ? "M8 6v8" : "M12 6v8"} strokeLinecap="round" />
    </svg>
  );
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const common = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className: "h-5 w-5 shrink-0",
    "aria-hidden": true,
  } as const;

  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 9.5L10 4l7 5.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.5 8.5V16h9V8.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "request":
      return <svg {...common}><path d="M6 3.5h6l3 3V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 8h4M9 11h4M9 14h3" strokeLinecap="round" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3.5" y="5" width="13" height="11.5" rx="2" /><path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13" strokeLinecap="round" /></svg>;
    case "checklist":
      return <svg {...common}><path d="M7.5 6.5h7M7.5 10h7M7.5 13.5h7M4.5 6.5l1 1 2-2M4.5 10l1 1 2-2M4.5 13.5l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "team":
      return <svg {...common}><path d="M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM13.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" strokeLinecap="round" /><path d="M3.5 15.5c.8-2 2.5-3 4.5-3s3.7 1 4.5 3M12 15.5c.5-1.2 1.5-1.9 2.9-2.1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "people":
      return <svg {...common}><path d="M6.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM13.5 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" strokeLinecap="round" /><path d="M2.8 16c.7-2.1 2.5-3.2 4.7-3.2S11.5 13.9 12.2 16M10.8 16c.5-1.8 2-2.8 4-2.8 1.1 0 2.1.3 2.9.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "userPlus":
      return <svg {...common}><path d="M8 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" strokeLinecap="round" /><path d="M3.5 16c.8-2 2.5-3 4.5-3s3.7 1 4.5 3M14.5 6h4M16.5 4v4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "settings":
      return <svg {...common}><path d="M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="M10 2.8v1.4M10 15.8v1.4M4.2 4.2l1 1M14.8 14.8l1 1M2.8 10h1.4M15.8 10h1.4M4.2 15.8l1-1M14.8 5.2l1-1" strokeLinecap="round" /></svg>;
    case "adjustments":
      return <svg {...common}><path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" /><circle cx="7" cy="6" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" /><circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" /></svg>;
    case "money":
      return <svg {...common}><rect x="3.5" y="5.5" width="13" height="9" rx="2" /><path d="M10 8v4M8.5 9.2c0-.7.7-1.2 1.5-1.2s1.5.5 1.5 1.2-.5 1-1.5 1.3-1.5.6-1.5 1.3.7 1.2 1.5 1.2 1.5-.5 1.5-1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="10" cy="10" r="6.5" /><path d="M10 6.8v3.6l2.4 1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "shield":
      return <svg {...common}><path d="M10 3l5 2v4.8c0 3.1-2.1 5.9-5 6.7-2.9-.8-5-3.6-5-6.7V5l5-2Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "chart":
      return <svg {...common}><path d="M4 15.5h12" strokeLinecap="round" /><path d="M6 13V9M10 13V6M14 13V8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "audit":
      return <svg {...common}><path d="M6 3.5h6l3 3V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 8.5h4M8 11h4M8 13.5h3" strokeLinecap="round" /></svg>;
  }
}

function SidebarLink({
  item,
  collapsed,
  active,
}: {
  item: SidebarNavItem;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center rounded-md transition-all ${
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
      } ${
        active
          ? "bg-slate-800 text-white shadow-sm"
          : "text-slate-100 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <SidebarIcon name={item.icon} />
      {!collapsed && <span className="truncate text-sm">{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
          {item.label}
        </span>
      )}
    </Link>
  );
}

export default function SidebarClient({
  sections,
  mobile = false,
}: {
  sections: SidebarNavSection[];
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (mobile) {
      setCollapsed(false);
      setOpenSections(buildDefaultOpenSections(sections, pathname));
      setHydrated(true);
      return;
    }

    const storedCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    const storedSections = window.localStorage.getItem(SIDEBAR_SECTION_STATE_KEY);
    const defaults = buildDefaultOpenSections(sections, pathname);

    setCollapsed(storedCollapsed === "true");

    if (storedSections) {
      try {
        const parsed = JSON.parse(storedSections) as Record<string, boolean>;
        setOpenSections({ ...defaults, ...parsed });
      } catch {
        setOpenSections(defaults);
      }
    } else {
      setOpenSections(defaults);
    }

    setHydrated(true);
  }, [mobile, pathname, sections]);

  useEffect(() => {
    if (!hydrated || mobile) {
      return;
    }

    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed, hydrated, mobile]);

  useEffect(() => {
    if (!hydrated || mobile) {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_SECTION_STATE_KEY,
      JSON.stringify(openSections)
    );
  }, [openSections, hydrated, mobile]);

  const renderedSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        isOpen: openSections[section.id] ?? true,
      })),
    [openSections, sections]
  );

  return (
    <aside
      className={`h-full bg-slate-900 p-4 text-white transition-[width] duration-200 ${
        mobile ? "w-full" : collapsed ? "w-20" : "w-72"
      }`}
    >
      <div className="mb-5 border-b border-slate-800 pb-4">
        <div
          className={`flex items-start ${
            !mobile && collapsed
              ? "flex-col items-center gap-3"
              : "justify-between gap-3"
          }`}
        >
          {mobile || !collapsed ? (
            <div>
              <div className="text-lg font-semibold">MFN HR</div>
              <div className="mt-1 text-xs text-slate-400">
                Managed Financial Networks
              </div>
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-semibold tracking-wide">
              MFN
            </div>
          )}

          {!mobile && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelToggleIcon collapsed={collapsed} />
            </button>
          )}
        </div>
      </div>

      <nav className="space-y-5">
        {renderedSections.map((section, index) => (
          <div
            key={section.id}
            className={`space-y-2 ${
              !mobile && collapsed && index > 0 ? "border-t border-slate-800 pt-4" : ""
            }`}
          >
            {(mobile || !collapsed) && (
              <button
                type="button"
                onClick={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section.id]: !(current[section.id] ?? true),
                  }))
                }
                aria-expanded={section.isOpen}
                className="flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 hover:text-slate-200"
              >
                <span>{section.title}</span>
                <ChevronIcon open={section.isOpen} />
              </button>
            )}

            {((!mobile && collapsed) || section.isOpen) && (
              <div className={!mobile && collapsed ? "space-y-2" : "space-y-1"}>
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    collapsed={!mobile && collapsed}
                    active={isItemActive(pathname, item.href)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
