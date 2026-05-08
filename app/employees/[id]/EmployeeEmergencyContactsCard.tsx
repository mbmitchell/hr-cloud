"use client";

import { useState } from "react";

import EmployeeProfileSection from "./EmployeeProfileSection";

type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  priority: number;
};

type DraftEmergencyContact = {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  priority: string;
};

function toDraft(contact?: EmergencyContact): DraftEmergencyContact {
  return {
    id: contact?.id,
    name: contact?.name ?? "",
    relationship: contact?.relationship ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    priority: contact ? String(contact.priority) : "1",
  };
}

export default function EmployeeEmergencyContactsCard({
  employeeId,
  contacts,
  canEdit,
}: {
  employeeId: string;
  contacts: EmergencyContact[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<DraftEmergencyContact>(toDraft());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const isEdit = Boolean(draft.id);
    const url = isEdit
      ? `/api/employees/${employeeId}/emergency-contacts/${draft.id}`
      : `/api/employees/${employeeId}/emergency-contacts`;

    try {
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draft.name,
          relationship: draft.relationship,
          phone: draft.phone,
          email: draft.email,
          priority: draft.priority,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save emergency contact.");
      } else {
        setMessage(
          isEdit
            ? "Emergency contact updated successfully."
            : "Emergency contact added successfully."
        );
        setDraft(toDraft());
        setTimeout(() => {
          window.location.reload();
        }, 700);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contactId: string) {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/employees/${employeeId}/emergency-contacts/${contactId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to delete emergency contact.");
      } else {
        setMessage("Emergency contact removed.");
        setDraft(toDraft());
        setTimeout(() => {
          window.location.reload();
        }, 700);
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EmployeeProfileSection title="Emergency Contacts" defaultExpanded>
      {!canEdit ? (
        <div className="text-sm text-slate-500">
          Emergency contacts are restricted to the employee and HR administrators.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            {contacts.length === 0 ? (
              <div className="text-sm text-slate-500">No emergency contacts added yet.</div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-lg border border-slate-200 p-4 text-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">
                        {contact.priority}. {contact.name}
                      </div>
                      <div>
                        <b>Relationship:</b> {contact.relationship}
                      </div>
                      <div>
                        <b>Phone:</b> {contact.phone}
                      </div>
                      <div>
                        <b>Email:</b> {contact.email ?? "-"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft(toDraft(contact))}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contact.id)}
                        disabled={saving}
                        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900">
              {draft.id ? "Edit Emergency Contact" : "Add Emergency Contact"}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Relationship</label>
                <input
                  type="text"
                  value={draft.relationship}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      relationship: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Phone</label>
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, phone: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, email: event.target.value }))
                  }
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Priority</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : draft.id ? "Save Contact" : "Add Contact"}
              </button>

              {draft.id ? (
                <button
                  type="button"
                  onClick={() => setDraft(toDraft())}
                  className="rounded border border-slate-300 px-4 py-2.5 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>

            {message ? <div className="text-sm text-slate-700">{message}</div> : null}
          </form>
        </div>
      )}
    </EmployeeProfileSection>
  );
}
