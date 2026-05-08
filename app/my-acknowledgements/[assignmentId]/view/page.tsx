import AcknowledgementDocumentViewer from "../../../../components/acknowledgements/acknowledgement-document-viewer";
import {
  assertCanViewEmployeeDocumentAssignments,
  requireDocumentAcknowledgementActor,
} from "../../../../lib/server/document-acknowledgements/access";
import { getDocumentAssignmentForAcknowledgement } from "../../../../lib/server/document-acknowledgements/queries";
import { isAuthorizationError } from "../../../../lib/server/authorization";

export default async function AcknowledgementDocumentViewerPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    const { assignmentId } = await params;
    const assignment = await getDocumentAssignmentForAcknowledgement(assignmentId);

    if (!assignment) {
      return <div className="text-red-600">Document assignment not found.</div>;
    }

    assertCanViewEmployeeDocumentAssignments(actor, assignment.employeeId);

    return (
      <AcknowledgementDocumentViewer
        assignment={{
          id: assignment.id,
          status: assignment.status,
          viewedAt: assignment.viewedAt
            ? assignment.viewedAt.toISOString()
            : null,
          acknowledgedAt: assignment.acknowledgedAt
            ? assignment.acknowledgedAt.toISOString()
            : null,
          document: {
            title: assignment.assignableDocument.title,
            category: assignment.assignableDocument.category,
          },
          version: {
            versionLabel: assignment.assignableDocumentVersion.versionLabel,
            employeeDocumentId:
              assignment.assignableDocumentVersion.employeeDocumentId,
            mimeType:
              assignment.assignableDocumentVersion.employeeDocument.mimeType,
            originalFileName:
              assignment.assignableDocumentVersion.employeeDocument
                .originalFileName,
          },
        }}
      />
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return <div className="text-red-600">{error.message}</div>;
    }

    throw error;
  }
}
