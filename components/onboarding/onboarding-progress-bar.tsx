export default function OnboardingProgressBar({
  value,
}: {
  value: number;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-slate-900 transition-[width]"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
