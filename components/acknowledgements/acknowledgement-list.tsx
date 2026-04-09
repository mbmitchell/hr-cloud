import ViewDocumentButton from "./view-document-button";

type Assignment = {
  id: string;
  status: string;
  assignedAt: string;
  dueDate: string | null;
  viewedAt: string | null;
  acknowledgedAt: string | null;
  document: {
    id: string;
    title: string;
    category: string;
  };
  version: {
    id: string;
    versionLabel: string;
    publishedAt: string;
    employeeDocumentId: string;
    originalFileName: string;
  };
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "ACKNOWLEDGED":
      return "bg-green-100 text-green-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "CANCELLED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AcknowledgementList({
  title,
  description,
  assignments,
  showAcknowledgeAction,
}: {
  title: string;
  description?: string;
  assignments: Assignment[];
  showAcknowledgeAction: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow sm:p-6">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            {showAcknowledgeAction
              ? "You have no pending acknowledgements right now."
              : "No acknowledged documents to show yet."}
          </div>
        ) : (
          assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="rounded-lg border border-slate-200 px-4 py-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">
                    {assignment.document.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {assignment.version.versionLabel} • {assignment.document.category}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <div className="text-slate-500">Assigned</div>
                      <div className="font-medium text-slate-900">
                        {formatDate(assignment.assignedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Due Date</div>
                      <div className="font-medium text-slate-900">
                        {formatDate(assignment.dueDate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Status</div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                            assignment.status
                          )}`}
                        >
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                    {showAcknowledgeAction && (
                      <div>
                        <div className="text-slate-500">Reviewed</div>
                        <div className="font-medium text-slate-900">
                          {assignment.viewedAt ? formatDate(assignment.viewedAt) : "Not yet"}
                        </div>
                      </div>
                    )}
                    {!showAcknowledgeAction && (
                      <div>
                        <div className="text-slate-500">Acknowledged</div>
                        <div className="font-medium text-slate-900">
                          {formatDate(assignment.acknowledgedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                  <ViewDocumentButton
                    assignmentId={assignment.id}
                    label={
                      showAcknowledgeAction
                        ? assignment.viewedAt
                          ? "Continue Review"
                          : "Review Document"
                        : "View Document"
                    }
                  />

                  {showAcknowledgeAction ? (
                    <div className="max-w-xs text-xs text-slate-500">
                      Open the document viewer to review the document and enable
                      acknowledgement.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
