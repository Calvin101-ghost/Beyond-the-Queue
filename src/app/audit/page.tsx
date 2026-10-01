"use client";

import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import { format } from "date-fns";
import Link from "next/link";

export default function AuditPage() {
  const hydrated = useStoreHydrated();
  const audit = useAppStore((s) => s.audit);
  const persona = useAppStore((s) => s.persona);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-[var(--muted)]">
        Loading audit log…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        Audit log
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Every open, change, triage, dose and escalation is time-stamped and
        attributed — the POPIA-minded trail for this demo.
      </p>
      {!persona && (
        <p className="mt-3 text-sm">
          <Link href="/login" className="text-[var(--teal-deep)] underline">
            Sign in
          </Link>{" "}
          so new actions carry your staff name.
        </p>
      )}

      <div className="surface mt-8 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((e) => (
              <tr key={e.id} className="border-b border-[var(--line)] last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                  {format(new Date(e.at), "d MMM HH:mm:ss")}
                </td>
                <td className="px-4 py-3">{e.actor}</td>
                <td className="px-4 py-3 font-medium">{e.action}</td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
