export type Priority = "critical" | "high" | "standard" | "low";

export type VisitCategory =
  | "emergency"
  | "injury"
  | "chronic-care"
  | "maternity"
  | "paediatrics"
  | "general"
  | "follow-up";

export type MedicalField =
  | "emergency"
  | "general-practice"
  | "cardiology"
  | "paediatrics"
  | "obstetrics"
  | "orthopaedics"
  | "internal-medicine";

export type PatientStatus =
  | "waiting"
  | "awaiting-triage"
  | "in-triage"
  | "with-clinician"
  | "admitted"
  | "discharged";

export type StaffRole =
  | "pending"
  | "front-desk"
  | "nurse"
  | "admin"
  | "emergency"
  | "general-practice"
  | "cardiology"
  | "paediatrics"
  | "obstetrics"
  | "orthopaedics"
  | "internal-medicine";

export interface DosageLog {
  id: string;
  medicine: string;
  dose: string;
  givenAt: string;
  givenBy: string;
}

export interface MealLog {
  id: string;
  meal: "breakfast" | "lunch" | "supper" | "snack";
  receivedAt: string;
  notes?: string;
}

/** One visit joined with the person it belongs to. `id` is the VISIT id. */
export interface Patient {
  id: string;
  /** Permanent patient (person) id. */
  patientId: string;
  /** Masked ID number. The full number is only available via revealId(). */
  idMasked: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  nextOfKin: string;
  nextOfKinContact: string;
  age: number;
  gender: "female" | "male" | "other" | "prefer-not-to-say";
  bloodType: string;
  medicalHistory: string;
  previousMedicine: string;
  currentMedicalStatus: string;
  reasonForVisit: string;
  visitCategory: VisitCategory;
  /** Priority suggested from reason category (reception cannot finalise). */
  suggestedPriority: Priority;
  /** Confirmed priority used in the live queue. */
  priority: Priority;
  triageConfirmed: boolean;
  triageOverrideReason?: string;
  escalated: boolean;
  escalatedFrom?: Priority;
  popiaConsent: boolean;
  medicalField: MedicalField;
  status: PatientStatus;
  arrivedAt: string;
  registeredAt: string;
  firstContactAt?: string;
  ward?: string;
  admissionReason?: string;
  dosages: DosageLog[];
  meals: MealLog[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  patientId?: string;
}

export interface EscalationSettings {
  /** Minutes on standard/low before escalate to high. */
  standardToHighMinutes: number;
  /** Minutes on high before escalate to critical. */
  highToCriticalMinutes: number;
  /** Target minutes for urgent patients to be seen. */
  urgentTargetMinutes: number;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  role: StaffRole;
  canViewClinical: boolean;
  canTriage: boolean;
  canRevealId: boolean;
  canManageSettings: boolean;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  standard: 2,
  low: 3,
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  standard: "Standard",
  low: "Low",
};

export const CATEGORY_LABELS: Record<VisitCategory, string> = {
  emergency: "Emergency",
  injury: "Injury / trauma",
  "chronic-care": "Chronic care",
  maternity: "Maternity",
  paediatrics: "Paediatrics",
  general: "General consultation",
  "follow-up": "Follow-up",
};

export const FIELD_LABELS: Record<MedicalField, string> = {
  emergency: "Emergency",
  "general-practice": "General practice",
  cardiology: "Cardiology",
  paediatrics: "Paediatrics",
  obstetrics: "Obstetrics",
  orthopaedics: "Orthopaedics",
  "internal-medicine": "Internal medicine",
};

export const STATUS_LABELS: Record<PatientStatus, string> = {
  waiting: "Waiting",
  "awaiting-triage": "Awaiting triage",
  "in-triage": "In triage",
  "with-clinician": "With clinician",
  admitted: "Admitted",
  discharged: "Discharged",
};

export const STAFF_LABELS: Record<StaffRole, string> = {
  pending: "Awaiting role",
  "front-desk": "Front desk",
  nurse: "Nurse / triage",
  admin: "Administrator",
  emergency: "Emergency clinician",
  "general-practice": "GP",
  cardiology: "Cardiology",
  paediatrics: "Paediatrics",
  obstetrics: "Obstetrics",
  orthopaedics: "Orthopaedics",
  "internal-medicine": "Internal medicine",
};

export const DEFAULT_SETTINGS: EscalationSettings = {
  standardToHighMinutes: 90,
  highToCriticalMinutes: 45,
  urgentTargetMinutes: 60,
};

export const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
] as const;

/** Roles that see every medical field. Mirrors can_see_field() in schema.sql. */
export function fieldForStaff(role: StaffRole): MedicalField | "all" {
  if (role === "front-desk" || role === "nurse" || role === "admin") return "all";
  if (role === "pending") return "all";
  return role;
}

/** Capability matrix. Mirrors the helper functions in supabase/schema.sql;
 *  the database enforces these rules, the UI only uses them to show/hide. */
export function capsForRole(
  role: StaffRole
): Pick<
  Persona,
  "canViewClinical" | "canTriage" | "canRevealId" | "canManageSettings"
> {
  const clinical = role !== "pending" && role !== "front-desk";
  return {
    canViewClinical: clinical,
    canTriage: role === "nurse" || role === "admin",
    canRevealId: clinical,
    canManageSettings: role === "admin",
  };
}

export interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

/** Fields captured at registration (the full ID number is write-only). */
export interface RegistrationInput {
  idNumber: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  nextOfKin: string;
  nextOfKinContact: string;
  age: number;
  gender: Patient["gender"];
  bloodType: string;
  medicalHistory: string;
  previousMedicine: string;
  currentMedicalStatus: string;
  reasonForVisit: string;
  visitCategory: VisitCategory;
  medicalField: MedicalField;
  popiaConsent: boolean;
}

export interface VisitInput {
  reasonForVisit: string;
  visitCategory: VisitCategory;
  medicalField: MedicalField;
}

