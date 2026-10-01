"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { STAFF_LABELS, type StaffRole } from "@/lib/types";
import { Select } from "@/components/ui/input";

export default function StaffPage() {
  const staff = useAppStore((s) => s.staff);
  const persona = useAppStore((s) => s.persona);
  const loadStaff = useAppStore((s) => s.loadStaff);
  const updateStaff = useAppStore((s) => s.updateStaff);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const waiting = staff.filter((s) => s.role === "pending" && s.active).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        Staff &amp; roles
      </h1>
      <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
        New sign-ups have no access until you give them a role. Clinical roles
        only see patients in their own department; the front desk cannot read
        medical history.
      </p>
      {waiting > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {waiting} account{waiting === 1 ? "" : "s"} waiting for a role.
        </p>
      )}

      <div className="surface mt-8 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3 font-medium">
                  {m.fullName || "—"}
                  {m.id === persona?.id && (
                    <span className="ml-2 text-xs text-[var(--muted)]">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">{m.email}</td>
                <td className="px-4 py-3">
                  <Select
                    aria-label={`Role for ${m.fullName || m.email}`}
                    className="h-9 w-[200px]"
                    value={m.role}
                    onChange={(e) =>
                      void updateStaff(m.id, { role: e.target.value as StaffRole })
                    }
                  >
                    {(Object.keys(STAFF_LABELS) as StaffRole[]).map((r) => (
                      <option key={r} value={r}>
                        {STAFF_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Active: ${m.fullName || m.email}`}
                    className="accent-[var(--teal)]"
                    checked={m.active}
                    onChange={(e) => void updateStaff(m.id, { active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
