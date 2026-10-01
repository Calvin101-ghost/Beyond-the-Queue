import type {
  DosageLog,
  MealLog,
  MedicalField,
  Patient,
  PatientStatus,
  Priority,
  VisitCategory,
} from "./types";

/** Columns the API is allowed to read from `patients` (id_number is blocked). */
export const PATIENT_COLS =
  "id,id_masked,name,address,contact,email,next_of_kin,next_of_kin_contact,age,gender,popia_consent,created_at";

/** A visit joined with its patient, clinical history and care logs. */
export const VISIT_SELECT = `*, patient:patients!inner(${PATIENT_COLS}, clinical:patient_clinical(blood_type,medical_history,previous_medicine,current_medical_status)), dosage_logs(*), meal_logs(*)`;

export interface PatientRow {
  id: string;
  id_masked: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  next_of_kin: string;
  next_of_kin_contact: string;
  age: number;
  gender: Patient["gender"];
  popia_consent: boolean;
  created_at: string;
  clinical?: ClinicalRow | ClinicalRow[] | null;
}
interface ClinicalRow {
  blood_type: string;
  medical_history: string;
  previous_medicine: string;
  current_medical_status: string;
}
interface DosageRow {
  id: string;
  medicine: string;
  dose: string;
  given_by: string;
  given_at: string;
}
interface MealRow {
  id: string;
  meal: MealLog["meal"];
  notes: string | null;
  received_at: string;
}
export interface VisitRow {
  id: string;
  patient_id: string;
  reason_for_visit: string;
  visit_category: VisitCategory;
  medical_field: MedicalField;
  suggested_priority: Priority;
  priority: Priority;
  triage_confirmed: boolean;
  triage_override_reason: string | null;
  escalated: boolean;
  escalated_from: Priority | null;
  status: PatientStatus;
  arrived_at: string;
  first_contact_at: string | null;
  ward: string | null;
  admission_reason: string | null;
  patient: PatientRow;
  dosage_logs?: DosageRow[] | null;
  meal_logs?: MealRow[] | null;
}

const byNewest = <T,>(get: (x: T) => string) => (a: T, b: T) =>
  new Date(get(b)).getTime() - new Date(get(a)).getTime();

export function mapVisit(v: VisitRow): Patient {
  const p = v.patient;
  const c = Array.isArray(p.clinical) ? p.clinical[0] : p.clinical;
  const dosages: DosageLog[] = (v.dosage_logs ?? [])
    .map((d) => ({
      id: d.id,
      medicine: d.medicine,
      dose: d.dose,
      givenAt: d.given_at,
      givenBy: d.given_by,
    }))
    .sort(byNewest((d) => d.givenAt));
  const meals: MealLog[] = (v.meal_logs ?? [])
    .map((m) => ({
      id: m.id,
      meal: m.meal,
      receivedAt: m.received_at,
      notes: m.notes ?? undefined,
    }))
    .sort(byNewest((m) => m.receivedAt));

  return {
    id: v.id,
    patientId: v.patient_id,
    idMasked: p.id_masked,
    name: p.name,
    address: p.address,
    contact: p.contact,
    email: p.email,
    nextOfKin: p.next_of_kin,
    nextOfKinContact: p.next_of_kin_contact,
    age: p.age,
    gender: p.gender,
    bloodType: c?.blood_type ?? "Unknown",
    medicalHistory: c?.medical_history ?? "",
    previousMedicine: c?.previous_medicine ?? "",
    currentMedicalStatus: c?.current_medical_status ?? "",
    reasonForVisit: v.reason_for_visit,
    visitCategory: v.visit_category,
    suggestedPriority: v.suggested_priority,
    priority: v.priority,
    triageConfirmed: v.triage_confirmed,
    triageOverrideReason: v.triage_override_reason ?? undefined,
    escalated: v.escalated,
    escalatedFrom: v.escalated_from ?? undefined,
    popiaConsent: p.popia_consent,
    medicalField: v.medical_field,
    status: v.status,
    arrivedAt: v.arrived_at,
    registeredAt: p.created_at,
    firstContactAt: v.first_contact_at ?? undefined,
    ward: v.ward ?? undefined,
    admissionReason: v.admission_reason ?? undefined,
    dosages,
    meals,
  };
}
