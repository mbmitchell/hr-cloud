import EmployeeOffboardingPanel from "./EmployeeOffboardingPanel";
import EmployeeOnboardingPanel from "./EmployeeOnboardingPanel";

type TemplateOption = {
  id: string;
  name: string;
};

export default function EmployeeLifecycleTab({
  employeeId,
  onboarding,
  activeOnboardingTemplates,
  offboarding,
  activeOffboardingTemplates,
  canCreate,
}: {
  employeeId: string;
  onboarding: {
    id: string;
    status: string;
    templateName: string | null;
    totalCount: number;
    completedCount: number;
    pendingCount: number;
    nextDueDate: string | null;
  } | null;
  activeOnboardingTemplates: TemplateOption[];
  offboarding: {
    id: string;
    status: string;
    separationType: string;
    terminationDate: string;
    completionPercentage: number;
    totalTasks: number;
    completedTasks: number;
  } | null;
  activeOffboardingTemplates: TemplateOption[];
  canCreate: boolean;
}) {
  return (
    <div className="space-y-6">
      <EmployeeOnboardingPanel
        employeeId={employeeId}
        onboarding={onboarding}
        activeTemplates={activeOnboardingTemplates}
        canCreate={canCreate}
        defaultExpanded
      />

      {canCreate && (
        <EmployeeOffboardingPanel
          employeeId={employeeId}
          offboarding={offboarding}
          activeTemplates={activeOffboardingTemplates}
          canCreate={canCreate}
          defaultExpanded
        />
      )}
    </div>
  );
}
