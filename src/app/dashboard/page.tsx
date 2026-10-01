"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import { PatientQueueCard } from "@/components/patient-queue-card";
import { FIELD_LABELS, STAFF_LABELS, fieldForStaff } from "@/lib/types";
import { formatWait } from "@/lib/utils";
import { queueMetrics } from "@/lib/logic";
import { Select } from "@/components/ui/input";
import type { StaffRole } from "@/lib/types";

export default function DashboardPage() {
  const hydrated = useStoreHydrated();
  const staffRole = useAppStore((s) => s.staffRole);
  const setStaffRole = useAppStore((s) => s.setStaffRole);
  const patients = useAppStore((s) => s.patients);
  const settings = useAppStore((s) => s.settings);
  const queuePatients = useAppStore((s) => s.queuePatients);
  const applyEscalations = useAppStore((s) => s.applyEscalations);
  const persona = useAppStore((s) => s.persona);
  const [now, setNow] = useState(0);
  const [escalationToast, setEscalationToast] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Escalation runs in the database; this just nudges it and shows the result.
    void applyEscalations().then((n) => {
      if (cancelled || n === 0) return;
      setEscalationToast(
        `${n} patient${n === 1 ? "" : "s"} auto-escalated due to long waits`
      );
      timer = setTimeout(() => setEscalationToast(null), 6000);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, applyEscalations, now]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-[var(--muted)]">
        Loading today&apos;s queue…
      </div>
    );
  }

  const { urgent, standard } = queuePatients();
  const field = fieldForStaff(staffRole);
  // Clinicians are locked to their own department by Row Level Security.
  const canFilter = !persona || fieldForStaff(persona.role) === "all";
  const metrics = queueMetrics(patients, settings, now || Date.now());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
            Staff queue
          </h1>
          <p className="mt-2 max-w-xl text-[var(--ink-soft)]">
            {persona
              ? `Signed in as ${persona.name} · `
              : "Guest view · "}
            Viewing{" "}
            <strong>{STAFF_LABELS[staffRole]}</strong>
            {field === "all"
              ? " — all fields. High priority first; urgent vs standard lists."
              : ` — only ${FIELD_LABELS[field]}, still sorted by priority.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Department filter
            <Select
              aria-label="Staff role"
              className="mt-1 h-9 w-[200px]"
              disabled={!canFilter}
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as StaffRole)}
            >
              {(Object.keys(STAFF_LABELS) as StaffRole[])
                .filter((role) => role !== "pending")
                .map((role) => (
                  <option key={role} value={role}>
                    {STAFF_LABELS[role]}
                  </option>
                ))}
            </Select>
          </label>
        </div>
      </div>

      {escalationToast && (
        <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          {escalationToast}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "In queue", value: String(metrics.inQueue) },
          { label: "Longest wait", value: formatWait(metrics.longestWait) },
          {
            label: "Median wait",
            value:
              metrics.medianWait == null ? "—" : formatWait(metrics.medianWait),
          },
          {
            label: "Median first contact",
            value:
              metrics.medianFirstContact == null
                ? "—"
                : formatWait(metrics.medianFirstContact),
          },
          {
            label: `Urgent ≤${settings.urgentTargetMinutes}m`,
            value:
              metrics.urgentOnTimePct == null
                ? "—"
                : `${metrics.urgentOnTimePct}%`,
          },
          { label: "Escalated", value: String(metrics.escalatedCount) },
        ].map((m) => (
          <div key={m.label} className="surface rounded-xl px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {m.label}
            </p>
            <p className="text-xl font-semibold text-[var(--ink)]">{m.value}</p>
          </div>
        ))}
      </div>

      {metrics.awaitingTriage > 0 && (
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          {metrics.awaitingTriage} awaiting triage confirmation.{" "}
          <Link href="/triage" className="font-medium text-[var(--teal-deep)]">
            Open triage →
          </Link>
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h2 className="text-lg font-semibold text-[var(--critical)]">
              Urgent list
            </h2>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Critical + high · {urgent.length}
            </span>
          </div>
          {urgent.length === 0 ? (
            <p className="py-8 text-sm text-[var(--muted)]">
              No urgent patients in this view.
            </p>
          ) : (
            urgent.map((p) => <PatientQueueCard key={p.id} patient={p} />)
          )}
        </section>

        <section className="surface rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h2 className="text-lg font-semibold text-[var(--teal-deep)]">
              Standard list
            </h2>
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Standard + low · {standard.length}
            </span>
          </div>
          {standard.length === 0 ? (
            <p className="py-8 text-sm text-[var(--muted)]">
              No standard-priority patients in this view.
            </p>
          ) : (
            standard.map((p) => <PatientQueueCard key={p.id} patient={p} />)
          )}
        </section>
      </div>
    </div>
  );
}
