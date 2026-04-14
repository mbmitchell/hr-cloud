type NoteItem = {
  label: string;
  text: string;
};

export default function ReportNotesPanel({
  purpose,
  sourceOfTruth,
  definitions,
  filterExportNote,
}: {
  purpose: string;
  sourceOfTruth: string;
  definitions: NoteItem[];
  filterExportNote: string;
}) {
  return (
    <section className="rounded bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Report Notes</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="text-sm font-medium text-slate-500">Report Purpose</div>
          <p className="mt-1 text-sm text-slate-700">{purpose}</p>
        </div>

        <div>
          <div className="text-sm font-medium text-slate-500">Source of Truth</div>
          <p className="mt-1 text-sm text-slate-700">{sourceOfTruth}</p>
        </div>

        <div className="lg:col-span-2">
          <div className="text-sm font-medium text-slate-500">Key Definitions</div>
          <dl className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {definitions.map((definition) => (
              <div key={definition.label}>
                <dt className="text-sm font-medium text-slate-900">
                  {definition.label}
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{definition.text}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-2">
          <div className="text-sm font-medium text-slate-500">
            Filter / Export Note
          </div>
          <p className="mt-1 text-sm text-slate-700">{filterExportNote}</p>
        </div>
      </div>
    </section>
  );
}
