"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export default function EmployeeProfileSection({
  title,
  children,
  defaultExpanded = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`rounded-xl bg-white p-5 shadow sm:p-6 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M5 7.5 10 12.5l5-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && <div className="mt-4">{children}</div>}
    </div>
  );
}
