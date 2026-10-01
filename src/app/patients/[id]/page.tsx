"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import {
  CATEGORY_LABELS,
  FIELD_LABELS,
  STATUS_LABELS,
  type PatientStatus,
  type VisitCategory,
} from "@/lib/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { formatWait, waitingMinutes } from "@/lib/utils";
import { defaultFieldForCategory } from "@/lib/logic";

export default function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const hydrated = useStoreHydrated();
  const patients = useAppStore((s) => s.patients);
  const updateStatus = useAppStore((s) => s.updateStatus);
  const admitPatient = useAppStore((s) => s.admitPatient);
  const persona = useAppStore((s) => s.persona);
  const startVisit = useAppStore((s) => s.startVisit);
  const revealedIds = useAppStore((s) => s.revealedIds);
  const revealId = useAppStore((s) => s.revealId);
  const logAudit = useAppStore((s) => s.logAudit);
  const [ward, setWard] = useState("");
  const [admissionReason, setAdmissionReason] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newCategory, setNewCategory] = useState<VisitCategory>("general");
  const router = useRouter();
  const loggedOpen = useRef<string | null>(null);

  const patient = patients.find((p) => p.id === id);

  useEffect(() => {
    if (!hydrated || !patient) return;
    if (loggedOpen.current === patient.id) return;
    loggedOpen.current = patient.id;
    logAudit(
      "open-record",
      `Opened profile for ${patient.name}`,
      patient.patientId,
      patient.id
    );
  }, [hydrated, patient, logAudit]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-[var(--muted)]">
        Loading profile…
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Patient not found</h1>
        <Link href="/search" className="mt-4 inline-block text-[var(--teal)]">
          Back to search
        </Link>
      </div>
    );
  }

  const fullId = revealedIds[patient.patientId];
  const showFullId = Boolean(fullId && persona?.canRevealId);
  const canClinical = Boolean(persona?.canViewClinical);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--muted)] hover:text-[var(--teal-deep)]"
      >
        ← Staff queue
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
            {patient.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <PriorityBadge priority={patient.priority} />
            <StatusBadge status={patient.status} />
            {patient.escalated && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                Escalated
              </span>
            )}
            {!patient.triageConfirmed && (
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
                Needs triage
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">
          Waiting {formatWait(waitingMinutes(patient.arrivedAt))} · arrived{" "}
          {format(new Date(patient.arrivedAt), "d MMM HH:mm")}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface space-y-6 rounded-2xl p-5 sm:p-6">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Identity &amp; contacts
            </h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--muted)]">ID number</dt>
                <dd className="inline-flex items-center gap-2 font-medium">
                  {showFullId ? fullId : patient.idMasked}
                  {persona?.canRevealId && !showFullId && (
                    <button
                      type="button"
                      className="text-xs text-[var(--teal-deep)] underline"
                      onClick={() => void revealId(patient.patientId)}
                    >
                      Reveal
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Age / gender</dt>
                <dd className="font-medium">
                  {patient.age} · {patient.gender}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Contact</dt>
                <dd className="font-medium">{patient.contact || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Email</dt>
                <dd className="font-medium">{patient.email || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--muted)]">Address</dt>
                <dd className="font-medium">{patient.address || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--muted)]">Next of kin</dt>
                <dd className="font-medium">
                  {patient.nextOfKin
                    ? `${patient.nextOfKin} (${patient.nextOfKinContact || "no contact"})`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Medical history
            </h2>
            {canClinical ? (
              <div className="mt-3 space-y-3 text-sm">
                <p>
                  <span className="text-[var(--muted)]">Blood type · </span>
                  {patient.bloodType}
                </p>
                <p>
                  <span className="text-[var(--muted)]">History · </span>
                  {patient.medicalHistory || "None recorded"}
                </p>
                <p>
                  <span className="text-[var(--muted)]">Previous medicine · </span>
                  {patient.previousMedicine || "None recorded"}
                </p>
                <p>
                  <span className="text-[var(--muted)]">Current status · </span>
                  {patient.currentMedicalStatus || "—"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Clinical details are hidden for reception. Sign in as triage or a
                clinician to view.
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              This visit
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-base font-medium">{patient.reasonForVisit}</p>
              <p>
                {CATEGORY_LABELS[patient.visitCategory]} ·{" "}
                {FIELD_LABELS[patient.medicalField]}
              </p>
              <p className="text-[var(--muted)]">
                Suggested {patient.suggestedPriority}
                {patient.triageConfirmed
                  ? ` · confirmed ${patient.priority}`
                  : " · awaiting triage confirmation"}
                {patient.triageOverrideReason
                  ? ` · override: ${patient.triageOverrideReason}`
                  : ""}
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface rounded-2xl p-5">
            <h2 className="text-sm font-semibold">Update status</h2>
            <Field label="Status" className="mt-3">
              <Select
                value={patient.status}
                onChange={(e) => {
                  const next = e.target.value as PatientStatus;
                  if (next !== "admitted") void updateStatus(patient.id, next);
                }}
              >
                {(Object.keys(STATUS_LABELS) as PatientStatus[])
                  .filter((s) => s !== "admitted")
                  .map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
              </Select>
            </Field>
            {!patient.triageConfirmed && (
              <Link
                href="/triage"
                className="mt-3 inline-flex text-sm font-medium text-[var(--teal-deep)]"
              >
                Confirm in triage →
              </Link>
            )}
          </section>

          {patient.status === "discharged" && (
            <section className="surface rounded-2xl p-5">
              <h2 className="text-sm font-semibold">Start a new visit</h2>
              <form
                className="mt-3 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newReason.trim()) return;
                  const id = await startVisit(patient.patientId, {
                    reasonForVisit: newReason.trim(),
                    visitCategory: newCategory,
                    medicalField: defaultFieldForCategory(newCategory),
                  });
                  if (id) {
                    setNewReason("");
                    router.push(`/patients/${id}`);
                  }
                }}
              >
                <Field label="Reason for visit">
                  <Input
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as VisitCategory)}
                  >
                    {(Object.keys(CATEGORY_LABELS) as VisitCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" className="w-full">
                  Send to triage
                </Button>
              </form>
            </section>
          )}

          {patient.status !== "admitted" ? (
            <section className="surface rounded-2xl p-5">
              <h2 className="text-sm font-semibold">Admit into hospital</h2>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void admitPatient(
                    patient.id,
                    ward.trim() || "General Ward",
                    admissionReason.trim() || patient.reasonForVisit
                  );
                  setWard("");
                  setAdmissionReason("");
                }}
              >
                <Field label="Ward / bed">
                  <Input
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="Medical Ward B · Bed 12"
                  />
                </Field>
                <Field label="What / admission reason">
                  <Input
                    value={admissionReason}
                    onChange={(e) => setAdmissionReason(e.target.value)}
                    placeholder={patient.reasonForVisit}
                  />
                </Field>
                <Button type="submit" className="w-full">
                  Admit patient
                </Button>
              </form>
            </section>
          ) : (
            <section className="surface rounded-2xl p-5">
              <h2 className="text-sm font-semibold">Admitted</h2>
              <p className="mt-2 text-sm">{patient.ward}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {patient.admissionReason}
              </p>
              <Link
                href="/admitted"
                className="mt-4 inline-flex text-sm font-medium text-[var(--teal-deep)]"
              >
                Open hospitalised care log →
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => void updateStatus(patient.id, "discharged")}
              >
                Discharge
              </Button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
