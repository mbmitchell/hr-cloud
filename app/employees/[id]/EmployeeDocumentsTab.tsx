import EmployeeDocumentsPanel from "../../../components/employees/employee-documents-panel";
import EmployeeAcknowledgementsSummaryPanel from "./EmployeeAcknowledgementsSummaryPanel";

export default function EmployeeDocumentsTab({
  employeeId,
  canUpload,
  canManage,
  acknowledgementSummary,
}: {
  employeeId: string;
  canUpload: boolean;
  canManage: boolean;
  acknowledgementSummary: {
    total: number;
    pending: number;
    acknowledged: number;
    overdue: number;
  } | null;
}) {
  return (
    <div className="space-y-6">
      <EmployeeDocumentsPanel
        employeeId={employeeId}
        canUpload={canUpload}
        canManage={canManage}
        defaultExpanded
      />

      {acknowledgementSummary && (
        <EmployeeAcknowledgementsSummaryPanel
          summary={acknowledgementSummary}
          defaultExpanded
        />
      )}
    </div>
  );
}
