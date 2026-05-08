import Link from "next/link";

type Requirement = {
  id: string;
  label: string;
  isRequired: boolean;
  assignableDocument: {
    id: string;
    title: string;
    category: string;
  };
  assignedDocumentVersion: {
    id: string;
    versionLabel: string;
    publishedAt: string;
  } | null;
  employeeDocumentAssignment: {
    id: string;
    status: string;
    assignedAt: string;
    dueDate: string | null;
    acknowledgedAt: string | null;
  } | null;
};

function getStatusLabel(status: string | null) {
  if (!status) {
    return "Pending";
  }

  if (status === "ACKNOWLEDGED") {
    return "Acknowledged";
  }

  if (status === "CANCELLED") {
    return "Cancelled";
  }

  return "Pending";
}

function getStatusClass(status: string | null) {
  if (status === "ACKNOWLEDGED") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "CANCELLED") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-amber-100 text-amber-800";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default function OnboardingTaskAcknowledgementRequirements({
  requirements,
  isEmployeeViewer,
  isAdminViewer,
}: {
  requirements: Requirement[];
  isEmployeeViewer: boolean;
  isAdminViewer: boolean;
}) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">
        Acknowledgements
      </div>

      <div className="mt-3 space-y-3">
        {requirements.map((requirement) => {
          const assignment = requirement.employeeDocumentAssignment;
          const status = getStatusLabel(assignment?.status ?? null);

          return (
            <div
              key={requirement.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    {requirement.label}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {requirement.assignableDocument.title}
                    {requirement.isRequired ? " • Required" : " • Optional"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Category: {requirement.assignableDocument.category}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Version: {requirement.assignedDocumentVersion?.versionLabel ?? "-"}
                  </div>
                </div>

                <div className="text-sm">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                      assignment?.status ?? null
                    )}`}
                  >
                    {status}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-slate-500">Assigned</div>
                  <div className="font-medium text-slate-900">
                    {formatDate(assignment?.assignedAt ?? null)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Due Date</div>
                  <div className="font-medium text-slate-900">
                    {formatDate(assignment?.dueDate ?? null)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Acknowledged</div>
                  <div className="font-medium text-slate-900">
                    {formatDate(assignment?.acknowledgedAt ?? null)}
                  </div>
                </div>
                {isAdminViewer && assignment && (
                  <div>
                    <div className="text-slate-500">Assignment</div>
                    <div className="font-medium text-slate-900 break-all">
                      {assignment.id}
                    </div>
                  </div>
                )}
              </div>

              {isEmployeeViewer && assignment && (
                <div className="mt-3">
                  <Link
                    href="/my-acknowledgements"
                    className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Go to My Acknowledgements
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
