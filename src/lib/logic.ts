import type {
  EscalationSettings,
  Patient,
  Priority,
  VisitCategory,
} from "./types";
import { PRIORITY_ORDER } from "./types";
import { waitingMinutes } from "./utils";

/** Reason category → suggested triage priority (reception cannot finalise). */
export function suggestPriority(category: VisitCategory): Priority {
  switch (category) {
    case "emergency":
      return "critical";
    case "maternity":
    case "paediatrics":
      return "high";
    case "injury":
    case "chronic-care":
      return "high";
    case "follow-up":
      return "standard";
    case "general":
    default:
      return "low";
  }
}

export function defaultFieldForCategory(
  category: VisitCategory
): Patient["medicalField"] {
  switch (category) {
    case "emergency":
      return "emergency";
    case "maternity":
      return "obstetrics";
    case "paediatrics":
      return "paediatrics";
    case "injury":
      return "orthopaedics";
    case "chronic-care":
      return "internal-medicine";
    default:
      return "general-practice";
  }
}

/** Mask SA ID for POPIA display: 920315••••083 */
export function maskIdNumber(idNumber: string): string {
  const cleaned = idNumber.replace(/\s/g, "");
  if (cleaned.length < 7) return "••••••••";
  return `${cleaned.slice(0, 6)}••••${cleaned.slice(-3)}`;
}

/**
 * Derive rough age + gender from a 13-digit SA ID (YYMMDD SSSS CAZ).
 * Returns null when the number is not 13 digits.
 */
export function deriveFromSaId(idNumber: string): {
  age: number;
  gender: Patient["gender"];
} | null {
  const cleaned = idNumber.replace(/\s/g, "");
  if (!/^\d{13}$/.test(cleaned)) return null;
  const yy = Number(cleaned.slice(0, 2));
  const mm = Number(cleaned.slice(2, 4));
  const dd = Number(cleaned.slice(4, 6));
  const now = new Date();
  const currentYy = now.getFullYear() % 100;
  const century = yy > currentYy ? 1900 : 2000;
  const birth = new Date(century + yy, mm - 1, dd);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  const genderDigit = Number(cleaned.slice(6, 10));
  const gender: Patient["gender"] = genderDigit >= 5000 ? "male" : "female";
  return { age: Math.max(0, age), gender };
}

export function isUrgentPriority(priority: Priority): boolean {
  return priority === "critical" || priority === "high";
}

/**
 * Automatic escalation: never downgrades.
 * standard/low → high after standardToHighMinutes
 * high → critical after highToCriticalMinutes
 */
export function computeEscalation(
  patient: Patient,
  settings: EscalationSettings,
  now = Date.now()
): { priority: Priority; escalated: boolean; from?: Priority } | null {
  if (
    patient.status === "admitted" ||
    patient.status === "discharged" ||
    patient.status === "with-clinician"
  ) {
    return null;
  }
  const waited = waitingMinutes(patient.arrivedAt, now);
  const current = patient.priority;

  if (
    (current === "standard" || current === "low") &&
    waited >= settings.standardToHighMinutes
  ) {
    return { priority: "high", escalated: true, from: current };
  }
  if (current === "high" && waited >= settings.highToCriticalMinutes) {
    return { priority: "critical", escalated: true, from: current };
  }
  return null;
}

export function sortQueue(a: Patient, b: Patient): number {
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0) return p;
  return new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime();
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

export function queueMetrics(
  patients: Patient[],
  settings: EscalationSettings,
  now = Date.now()
) {
  const active = patients.filter(
    (p) => p.status !== "admitted" && p.status !== "discharged"
  );
  const waits = active.map((p) => waitingMinutes(p.arrivedAt, now));
  const urgent = active.filter((p) => isUrgentPriority(p.priority));
  const urgentSeenOnTime = urgent.filter((p) => {
    if (!p.firstContactAt) {
      return waitingMinutes(p.arrivedAt, now) <= settings.urgentTargetMinutes;
    }
    return (
      waitingMinutes(p.arrivedAt, new Date(p.firstContactAt).getTime()) <=
      settings.urgentTargetMinutes
    );
  });
  const contactTimes = patients
    .filter((p) => p.firstContactAt)
    .map((p) =>
      waitingMinutes(p.arrivedAt, new Date(p.firstContactAt!).getTime())
    );

  return {
    inQueue: active.length,
    longestWait: waits.length ? Math.max(...waits) : 0,
    medianWait: median(waits),
    medianFirstContact: median(contactTimes),
    urgentCount: urgent.length,
    urgentOnTimePct:
      urgent.length === 0
        ? null
        : Math.round((urgentSeenOnTime.length / urgent.length) * 100),
    escalatedCount: active.filter((p) => p.escalated).length,
    awaitingTriage: active.filter(
      (p) => p.status === "awaiting-triage" || !p.triageConfirmed
    ).length,
  };
}
