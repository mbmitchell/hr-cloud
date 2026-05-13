"use client";

import { useEffect, useState } from "react";

import { dateToDateOnlyString, formatDateOnlyForDisplay } from "../../../lib/date-only";

type HolidayRow = {
  id: string;
  code: string | null;
  name: string;
  date: string;
  year: number;
  source: "FEDERAL_SEED" | "MANUAL";
  countsAsCompanyHoliday: boolean;
  isActive: boolean;
  notes: string | null;
};

type HolidayDraft = {
  name: string;
  date: string;
  countsAsCompanyHoliday: boolean;
  isActive: boolean;
  notes: string;
};

function toDraft(holiday: HolidayRow): HolidayDraft {
  return {
    name: holiday.name,
    date: holiday.date,
    countsAsCompanyHoliday: holiday.countsAsCompanyHoliday,
    isActive: holiday.isActive,
    notes: holiday.notes ?? "",
  };
}

const currentYear = Number(dateToDateOnlyString(new Date()).slice(0, 4));

export default function HolidaysAdminClient() {
  const [year, setYear] = useState(String(currentYear));
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HolidayDraft>>({});
  const [newHoliday, setNewHoliday] = useState<HolidayDraft>({
    name: "",
    date: "",
    countsAsCompanyHoliday: true,
    isActive: true,
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadHolidays(selectedYear: string, options?: { preserveMessage?: boolean }) {
    setLoading(true);
    if (!options?.preserveMessage) {
      setMessage("");
    }

    try {
      const response = await fetch(`/api/admin/holidays?year=${encodeURIComponent(selectedYear)}`);
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to load company holidays.");
        setHolidays([]);
        setDrafts({});
        return;
      }

      const nextHolidays = (data.holidays ?? []) as HolidayRow[];
      setHolidays(nextHolidays);
      setDrafts(
        Object.fromEntries(
          nextHolidays.map((holiday) => [holiday.id, toDraft(holiday)])
        )
      );
    } catch {
      setMessage("Unable to load company holidays.");
      setHolidays([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHolidays(year);
  }, [year]);

  function updateDraft(id: string, patch: Partial<HolidayDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  async function handleSeedYear() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/holidays/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: Number(year),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to seed federal holidays.");
        return;
      }

      await loadHolidays(year, { preserveMessage: true });
      setMessage(`Seeded ${data.seededCount} federal holiday defaults for ${year}.`);
    } catch {
      setMessage("Unable to seed federal holidays.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateHoliday() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newHoliday,
          notes: newHoliday.notes.trim() || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to create company holiday.");
        return;
      }

      setNewHoliday({
        name: "",
        date: "",
        countsAsCompanyHoliday: true,
        isActive: true,
        notes: "",
      });
      if (String(data.holiday?.year) !== year) {
        setYear(String(data.holiday?.year ?? year));
        setMessage("Company holiday added.");
      } else {
        await loadHolidays(year, { preserveMessage: true });
        setMessage("Company holiday added.");
      }
    } catch {
      setMessage("Unable to create company holiday.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveHoliday(id: string) {
    const draft = drafts[id];

    if (!draft) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/holidays/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...draft,
          notes: draft.notes.trim() || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save holiday changes.");
        return;
      }

      await loadHolidays(year, { preserveMessage: true });
      setMessage("Holiday updated.");
    } catch {
      setMessage("Unable to save holiday changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const draft = drafts[id];

    if (!draft) {
      return;
    }

    await handleSaveHolidayWithPatch(id, {
      ...draft,
      isActive: !isActive,
    });
  }

  async function handleSaveHolidayWithPatch(id: string, draft: HolidayDraft) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/holidays/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...draft,
          notes: draft.notes.trim() || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to update company holiday.");
        return;
      }

      await loadHolidays(year, { preserveMessage: true });
      setMessage(draft.isActive ? "Holiday activated." : "Holiday deactivated.");
    } catch {
      setMessage("Unable to update company holiday.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHoliday(id: string) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/holidays/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to delete company holiday.");
        return;
      }

      await loadHolidays(year, { preserveMessage: true });
      setMessage("Holiday deleted.");
    } catch {
      setMessage("Unable to delete company holiday.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-4 shadow sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Holiday Year</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="w-full rounded border px-3 py-2 md:w-40"
            />
          </div>

          <button
            type="button"
            onClick={handleSeedYear}
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Working..." : `Seed Federal Holidays for ${year}`}
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Seeding creates the standard U.S. federal observed holiday defaults for the selected year and skips duplicates.
        </p>
      </div>

      <div className="rounded-xl bg-white p-4 shadow sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Add Manual Holiday</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Holiday Name</label>
            <input
              type="text"
              value={newHoliday.name}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Date</label>
            <input
              type="date"
              value={newHoliday.date}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newHoliday.countsAsCompanyHoliday}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  countsAsCompanyHoliday: event.target.checked,
                }))
              }
            />
            Exclude this date from PTO calculations
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newHoliday.isActive}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Active
          </label>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Notes</label>
            <textarea
              value={newHoliday.notes}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="min-h-24 w-full rounded border px-3 py-2"
              placeholder="Optional notes or company-specific context"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateHoliday}
          disabled={saving}
          className="mt-4 rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Add Holiday
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{year} Holidays</h2>
          <div className="text-sm text-slate-500">{holidays.length} configured</div>
        </div>

        {message ? <div className="mt-4 text-sm text-slate-700">{message}</div> : null}

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">Loading company holidays...</div>
        ) : holidays.length === 0 ? (
          <div className="mt-4 rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No holidays are configured for {year} yet.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {holidays.map((holiday) => {
              const draft = drafts[holiday.id] ?? toDraft(holiday);

              return (
                <div key={holiday.id} className="rounded border p-4">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{holiday.name}</div>
                      <div className="text-sm text-slate-500">
                        {formatDateOnlyForDisplay(holiday.date)} • {holiday.source === "FEDERAL_SEED" ? "Federal seed" : "Manual"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {holiday.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Name</label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft(holiday.id, { name: event.target.value })
                        }
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Date</label>
                      <input
                        type="date"
                        value={draft.date}
                        onChange={(event) =>
                          updateDraft(holiday.id, { date: event.target.value })
                        }
                        className="w-full rounded border px-3 py-2"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.countsAsCompanyHoliday}
                        onChange={(event) =>
                          updateDraft(holiday.id, {
                            countsAsCompanyHoliday: event.target.checked,
                          })
                        }
                      />
                      Exclude from PTO calculations
                    </label>

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          updateDraft(holiday.id, { isActive: event.target.checked })
                        }
                      />
                      Active
                    </label>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium">Notes</label>
                      <textarea
                        value={draft.notes}
                        onChange={(event) =>
                          updateDraft(holiday.id, { notes: event.target.value })
                        }
                        className="min-h-24 w-full rounded border px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleSaveHoliday(holiday.id)}
                      disabled={saving}
                      className="rounded bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      Save Changes
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(holiday.id, holiday.isActive)}
                      disabled={saving}
                      className="rounded border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {holiday.isActive ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      disabled={saving}
                      className="rounded bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
