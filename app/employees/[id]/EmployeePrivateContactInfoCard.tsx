"use client";

import { useState } from "react";

import EmployeeProfileSection from "./EmployeeProfileSection";

type ContactInfo = {
  preferredName: string | null;
  personalEmail: string | null;
  mobilePhone: string | null;
  homePhone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
} | null;

export default function EmployeePrivateContactInfoCard({
  employeeId,
  contactInfo,
  canEdit,
}: {
  employeeId: string;
  contactInfo: ContactInfo;
  canEdit: boolean;
}) {
  const [preferredName, setPreferredName] = useState(contactInfo?.preferredName ?? "");
  const [personalEmail, setPersonalEmail] = useState(contactInfo?.personalEmail ?? "");
  const [mobilePhone, setMobilePhone] = useState(contactInfo?.mobilePhone ?? "");
  const [homePhone, setHomePhone] = useState(contactInfo?.homePhone ?? "");
  const [street1, setStreet1] = useState(contactInfo?.street1 ?? "");
  const [street2, setStreet2] = useState(contactInfo?.street2 ?? "");
  const [city, setCity] = useState(contactInfo?.city ?? "");
  const [state, setState] = useState(contactInfo?.state ?? "");
  const [postalCode, setPostalCode] = useState(contactInfo?.postalCode ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/employees/${employeeId}/contact-info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredName,
          personalEmail,
          mobilePhone,
          homePhone,
          street1,
          street2,
          city,
          state,
          postalCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Unable to save contact information.");
      } else {
        setMessage("Contact information updated successfully.");
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
    <EmployeeProfileSection title="Personal / Contact Information" defaultExpanded>
      {!canEdit ? (
        <div className="text-sm text-slate-500">
          Private contact information is restricted to the employee and HR administrators.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Preferred Name</label>
              <input
                type="text"
                value={preferredName}
                onChange={(event) => setPreferredName(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Personal Email</label>
              <input
                type="email"
                value={personalEmail}
                onChange={(event) => setPersonalEmail(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Mobile Phone</label>
              <input
                type="text"
                value={mobilePhone}
                onChange={(event) => setMobilePhone(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Home Phone</label>
              <input
                type="text"
                value={homePhone}
                onChange={(event) => setHomePhone(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Street 1</label>
              <input
                type="text"
                value={street1}
                onChange={(event) => setStreet1(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Street 2</label>
              <input
                type="text"
                value={street2}
                onChange={(event) => setStreet2(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">City</label>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">State</label>
              <input
                type="text"
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving..." : "Save Contact Information"}
          </button>

          {message ? <div className="text-sm text-slate-700">{message}</div> : null}
        </form>
      )}
    </EmployeeProfileSection>
  );
}
