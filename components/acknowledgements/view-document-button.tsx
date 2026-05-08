"use client";

import { useRouter } from "next/navigation";

export default function ViewDocumentButton({
  assignmentId,
  label,
}: {
  assignmentId: string;
  label?: string;
}) {
  const router = useRouter();

  function handleView() {
    router.push(`/my-acknowledgements/${assignmentId}/view`);
  }

  return (
    <button
      type="button"
      onClick={handleView}
      className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
    >
      {label ?? "View Document"}
    </button>
  );
}
