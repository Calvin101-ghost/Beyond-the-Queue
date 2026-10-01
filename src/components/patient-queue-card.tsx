"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { Patient, PatientStatus } from "@/lib/types";
import {
  CATEGORY_LABELS,
  FIELD_LABELS,
  STATUS_LABELS
} from "@/lib/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { formatWait, waitingMinutes } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const statusOptions: PatientStatus[] = [
  "waiting",
  "awaiting-triage",
  "in-triage",
  "with-clinician",
  "admitted",
  "discharged",
];

export function PatientQueueCard({
  patient,
  showActions = true,
}: {
  patient: Patient;
  showActions?: boolean;
}) {
  const updateStatus = useAppStore((s) => s.updateStatus);
  const admitPatient = useAppStore((s) => s.admitPatient);
  const startConsultation = useAppStore((s) => s.startConsultation);
  const persona = useAppStore((s) => s.persona);
  const revealedIds = useAppStore((s) => s.revealedIds);
  const revealId = useAppStore((s) => s.revealId);
  const wait = waitingMinutes(patient.arrivedAt);
  const fullId = revealedIds[patient.patientId];
  const showFullId = Boolean(fullId && persona?.canRevealId);

  return (
    <article className="border-b border-[var(--line)] py-4 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/patients/${patient.id}`}
              className="truncate text-lg font-semibold text-[var(--ink)] hover:text-[var(--teal-deep)]"
            >
              {patient.name}
            </Link>
            <PriorityBadge priority={patient.priority} />
            <StatusBadge status={patient.status} />
            {patient.escalated && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                Escalated
                {patient.escalatedFrom ? ` from ${patient.escalatedFrom}` : ""}
              </span>
            )}
            {!patient.triageConfirmed && (
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
                Needs triage
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--ink-soft)]">{patient.reasonForVisit}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span>{CATEGORY_LABELS[patient.visitCategory]}</span>
            <span>{FIELD_LABELS[patient.medicalField]}</span>
            <span className="inline-flex items-center gap-1 font-medium text-[var(--ink-soft)]">
              <Clock3 className="h-3.5 w-3.5" />
              Waiting {formatWait(wait)}
            </span>
            <span className="inline-flex items-center gap-1">
              ID {showFullId ? fullId : patient.idMasked}
              {persona?.canRevealId && !showFullId && (
                <button
                  type="button"
                  className="text-[var(--teal-deep)] underline"
                  onClick={() => void revealId(patient.patientId)}
                >
                  Reveal
                </button>
              )}
            </span>
          </div>
        </div>
        {showActions && (
          <div className="flex shrink-0 flex-col gap-2 sm:w-48">
            <Select
              aria-label={`Update status for ${patient.name}`}
              value={patient.status}
              onChange={(e) => {
                const next = e.target.value as PatientStatus;
                if (next === "admitted") {
                  const ward =
                    prompt("Ward / bed (e.g. Medical Ward B · Bed 12)") ||
                    "General Ward";
                  const reason =
                    prompt("Admission reason") || patient.reasonForVisit;
                  void admitPatient(patient.id, ward, reason);
                } else if (next === "with-clinician") {
                  void startConsultation(patient.id);
                } else {
                  void updateStatus(patient.id, next);
                }
              }}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Link
              href={`/patients/${patient.id}`}
              className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--line)] bg-white/70 px-3 text-xs font-medium text-[var(--ink)] hover:bg-white"
            >
              Open profile
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
