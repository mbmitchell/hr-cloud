"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
    </svg>
  );
}

export default function AppShell({
  desktopSidebar,
  mobileSidebar,
  header,
  children,
}: {
  desktopSidebar: React.ReactNode;
  mobileSidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen md:flex">
      <div className="hidden md:block md:shrink-0">{desktopSidebar}</div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileNavOpen(false)}
          />

          <div
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-2xl"
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("a[href]")) {
                setMobileNavOpen(false);
              }
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white">
              <div className="text-sm font-semibold tracking-wide">
                Navigation
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                className="rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-100"
                onClick={() => setMobileNavOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            {mobileSidebar}
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:hidden">
          <div>
            <div className="text-sm font-semibold text-slate-900">MFN HR</div>
            <div className="text-xs text-slate-500">
              Managed Financial Networks
            </div>
          </div>
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-700"
            onClick={() => setMobileNavOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>

        <div className="min-w-0">{header}</div>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
