import AcknowledgementList from "../../components/acknowledgements/acknowledgement-list";
import { requireDocumentAcknowledgementActor } from "../../lib/server/document-acknowledgements/access";
import { listEmployeeDocumentAssignmentsForActor } from "../../lib/server/document-acknowledgements/queries";
import { isAuthorizationError } from "../../lib/server/authorization";

export default async function MyAcknowledgementsPage() {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    const assignments = await listEmployeeDocumentAssignmentsForActor(
      actor,
      actor.id
    );

    const pendingAssignments = assignments
      .filter((assignment) => assignment.status === "PENDING")
      .map((assignment) => ({
        ...assignment,
        assignedAt: assignment.assignedAt.toISOString(),
        dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
        viewedAt: assignment.viewedAt ? assignment.viewedAt.toISOString() : null,
        acknowledgedAt: assignment.acknowledgedAt
          ? assignment.acknowledgedAt.toISOString()
          : null,
        version: {
          ...assignment.version,
          publishedAt: assignment.version.publishedAt.toISOString(),
        },
      }));

    const acknowledgedAssignments = assignments
      .filter((assignment) => assignment.status === "ACKNOWLEDGED")
      .map((assignment) => ({
        ...assignment,
        assignedAt: assignment.assignedAt.toISOString(),
        dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
        viewedAt: assignment.viewedAt ? assignment.viewedAt.toISOString() : null,
        acknowledgedAt: assignment.acknowledgedAt
          ? assignment.acknowledgedAt.toISOString()
          : null,
        version: {
          ...assignment.version,
          publishedAt: assignment.version.publishedAt.toISOString(),
        },
      }));

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">My Acknowledgements</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review assigned policy documents and complete required acknowledgements.
          </p>
        </div>

        <AcknowledgementList
          title="Pending Acknowledgements"
          description="Documents waiting for your acknowledgement."
          assignments={pendingAssignments}
          showAcknowledgeAction
        />

        <AcknowledgementList
          title="Acknowledged Documents"
          description="Documents you have already acknowledged."
          assignments={acknowledgedAssignments}
          showAcknowledgeAction={false}
        />
      </div>
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return <div className="text-red-600">{error.message}</div>;
    }

    throw error;
  }
}
