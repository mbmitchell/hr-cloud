import EmployeeProfileSection from "./EmployeeProfileSection";

function formatCurrency(value: string | null) {
  if (value == null) {
    return "-";
  }

  return Number(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export default function EmployeeTotalCompensationSummaryCard({
  summary,
  payType,
}: {
  summary: {
    baseCompensationAnnual: string | null;
    employerMonthlyBenefitCost: string;
    employerAnnualBenefitCost: string;
    estimatedTotalAnnualCompensation: string | null;
  };
  payType: "SALARY" | "HOURLY" | null;
}) {
  return (
    <EmployeeProfileSection title="Total Compensation Summary" defaultExpanded>
      <div className="space-y-4 text-sm text-slate-700">
        <p className="text-slate-600">
          Estimated from the current compensation profile and enrolled employer-paid benefit costs.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Base Compensation
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.baseCompensationAnnual)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {payType === "HOURLY"
                ? "Annualized from hourly rate x standard hours x 52 weeks."
                : payType === "SALARY"
                  ? "Current annual salary from the compensation profile."
                  : "Add a compensation profile to calculate base compensation."}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Estimated Total Annual Compensation
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.estimatedTotalAnnualCompensation)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Base compensation plus annualized employer benefit cost.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Employer Monthly Benefit Cost
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(summary.employerMonthlyBenefitCost)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Employer Annualized Benefit Cost
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(summary.employerAnnualBenefitCost)}
            </div>
          </div>
        </div>
      </div>
    </EmployeeProfileSection>
  );
}
