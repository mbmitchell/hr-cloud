"use client";

import { useEffect, useState } from "react";

export default function PolicyAdminClient() {
  const [accrualRate0To5, setAccrualRate0To5] = useState("10");
  const [accrualRate6To10, setAccrualRate6To10] = useState("13.33");
  const [accrualRateOver10, setAccrualRateOver10] = useState("16.67");
  const [rolloverCapHours, setRolloverCapHours] = useState("80");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const response = await fetch("/api/admin/policy");
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.error || "Unable to load policy settings.");
          return;
        }

        setAccrualRate0To5(String(data.accrualRate0To5));
        setAccrualRate6To10(String(data.accrualRate6To10));
        setAccrualRateOver10(String(data.accrualRateOver10));
        setRolloverCapHours(String(data.rolloverCapHours));
      } catch {
        setMessage("Unable to load policy settings.");
      } finally {
        setLoading(false);
      }
    }

    loadPolicy();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accrualRate0To5,
          accrualRate6To10,
          accrualRateOver10,
          rolloverCapHours,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save policy settings.");
      } else {
        setMessage("Policy settings updated successfully.");
      }
    } catch {
      setMessage("Unable to save policy settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-slate-600">Loading policy settings...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PTO Policy Settings</h2>
        <p className="text-sm text-slate-600 mt-1">
          Manage accrual tiers and year-end rollover limits.
        </p>
      </div>

      <div className="bg-white rounded shadow p-4 sm:p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">0-5 Years Accrual</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={accrualRate0To5}
                onChange={(e) => setAccrualRate0To5(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">6-10 Years Accrual</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={accrualRate6To10}
                onChange={(e) => setAccrualRate6To10(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">10+ Years Accrual</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={accrualRateOver10}
                onChange={(e) => setAccrualRateOver10(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rollover Cap Hours</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rolloverCapHours}
                onChange={(e) => setRolloverCapHours(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving..." : "Save Policy Settings"}
          </button>

          {message && <div className="text-sm text-slate-700">{message}</div>}
        </form>
      </div>
    </div>
  );
}
