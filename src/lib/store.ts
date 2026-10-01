"use client";

import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getConfigProblem, getSupabase } from "./supabase/client";
import { PATIENT_COLS, VISIT_SELECT, mapVisit, type VisitRow } from "./db";
import { isUrgentPriority, sortQueue } from "./logic";
import type {
  AuditEntry,
  DosageLog,
  EscalationSettings,
  MealLog,
  Patient,
  PatientStatus,
  Persona,
  Priority,
  RegistrationInput,
  StaffProfile,
  StaffRole,
  VisitInput,
} from "./types";
import {
  DEFAULT_SETTINGS,
  PRIORITY_ORDER,
  STAFF_LABELS,
  capsForRole,
  fieldForStaff,
} from "./types";

export interface SearchResult {
  patientId: string;
  name: string;
  idMasked: string;
  contact: string;
  /** Latest visit this user is allowed to see (null if none visible). */
  visit: Patient | null;
}

interface AppState {
  configProblem: string | null;
  authReady: boolean;
  /** True once the first data load after sign-in has finished. */
  loaded: boolean;
  persona: Persona | null;
  /** Department filter for staff who can see every field. */
  staffRole: StaffRole;
  patients: Patient[];
  settings: EscalationSettings;
  audit: AuditEntry[];
  staff: StaffProfile[];
  /** Full ID numbers revealed this session, keyed by patient (person) id. Memory only. */
  revealedIds: Record<string, string>;
  notice: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  setNotice: (message: string | null) => void;
  setStaffRole: (role: StaffRole) => void;
  refresh: () => Promise<void>;

  addPatient: (input: RegistrationInput) => Promise<string | undefined>;
  startVisit: (patientId: string, input: VisitInput) => Promise<string | undefined>;
  findByIdNumber: (idNumber: string) => Promise<string | null>;
  searchPatients: (query: string) => Promise<SearchResult | null>;
  revealId: (patientId: string) => Promise<void>;
  logAudit: (
    action: string,
    detail: string,
    patientId?: string,
    visitId?: string
  ) => void;

  updateStatus: (id: string, status: PatientStatus) => Promise<void>;
  confirmTriage: (
    id: string,
    priority: Priority,
    overrideReason?: string
  ) => Promise<void>;
  startConsultation: (id: string) => Promise<void>;
  admitPatient: (id: string, ward: string, admissionReason: string) => Promise<void>;
  addDosage: (
    visitId: string,
    log: Omit<DosageLog, "id" | "givenAt">
  ) => Promise<void>;
  addMeal: (
    visitId: string,
    log: Omit<MealLog, "id" | "receivedAt"> & { receivedAt?: string }
  ) => Promise<void>;
  applyEscalations: () => Promise<number>;
  updateSettings: (patch: Partial<EscalationSettings>) => Promise<void>;
  loadStaff: () => Promise<void>;
  updateStaff: (
    id: string,
    patch: { role?: StaffRole; active?: boolean }
  ) => Promise<void>;

  queuePatients: () => { urgent: Patient[]; standard: Patient[] };
  triageQueue: () => Patient[];
  admittedPatients: () => Patient[];
  todaysPatients: () => Patient[];
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

/** Throw if a Supabase response carries an error, otherwise return its data. */
function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: StaffRole;
  active: boolean;
};

let started = false;
let channel: RealtimeChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>()((set, get) => {
  /** Run a mutation, surface any database error as a notice, then refresh. */
  async function mutate<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      const out = await fn();
      await get().refresh();
      return out;
    } catch (e) {
      set({ notice: errMsg(e) });
      return undefined;
    }
  }

  function stopLive() {
    if (channel) {
      void getSupabase().removeChannel(channel);
      channel = null;
    }
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function startLive() {
    stopLive();
    const soon = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void get().refresh(), 400);
    };
    let ch = getSupabase().channel("beyond-queue-live");
    for (const table of [
      "visits",
      "dosage_logs",
      "meal_logs",
      "settings",
      "patient_clinical",
    ]) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, soon);
    }
    channel = ch.subscribe();
    // Fallback in case realtime is not enabled or a socket drops.
    pollTimer = setInterval(() => void get().refresh(), 30_000);
  }

  async function handleSession(userId: string | null) {
    if (!userId) {
      stopLive();
      set({
        persona: null,
        patients: [],
        audit: [],
        staff: [],
        revealedIds: {},
        loaded: false,
        authReady: true,
      });
      return;
    }
    const res = await getSupabase()
      .from("staff_profiles")
      .select("id,full_name,email,role,active")
      .eq("id", userId)
      .maybeSingle();
    const row = res.data as ProfileRow | null;
    if (!row) {
      set({
        persona: null,
        authReady: true,
        notice:
          "Your staff profile was not found. Make sure supabase/schema.sql was run, then sign up again.",
      });
      return;
    }
    const role: StaffRole = row.active ? row.role : "pending";
    const persona: Persona = {
      id: row.id,
      name: row.full_name || row.email || "Staff member",
      title: STAFF_LABELS[role],
      role,
      ...capsForRole(role),
    };
    set({ persona, staffRole: role, authReady: true });
    if (role === "pending") {
      stopLive();
      set({ loaded: true });
      return;
    }
    await get().refresh();
    set({ loaded: true });
    startLive();
  }

  return {
    configProblem: getConfigProblem(),
    authReady: false,
    loaded: false,
    persona: null,
    staffRole: "front-desk",
    patients: [],
    settings: { ...DEFAULT_SETTINGS },
    audit: [],
    staff: [],
    revealedIds: {},
    notice: null,

    init: async () => {
      if (started) return;
      started = true;
      if (getConfigProblem()) {
        set({ authReady: true });
        return;
      }
      // Defer: awaiting Supabase calls inside this callback can deadlock.
      getSupabase().auth.onAuthStateChange((_event, session) => {
        setTimeout(() => void handleSession(session?.user.id ?? null), 0);
      });
      window.addEventListener("focus", () => {
        const role = get().persona?.role;
        if (role && role !== "pending") void get().refresh();
      });
    },

    signIn: async (email, password) => {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;
      get().logAudit("login", "Signed in");
      return null;
    },

    signUp: async (email, password, fullName) => {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) return { error: error.message, needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    },

    signOut: async () => {
      get().logAudit("logout", "Signed out");
      await new Promise((r) => setTimeout(r, 150));
      await getSupabase().auth.signOut();
    },

    setNotice: (message) => set({ notice: message }),
    setStaffRole: (role) => set({ staffRole: role }),

    refresh: async () => {
      const persona = get().persona;
      if (!persona || persona.role === "pending") return;
      const sb = getSupabase();
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const [visits, settings, audit] = await Promise.all([
          sb
            .from("visits")
            .select(VISIT_SELECT)
            .or(`status.neq.discharged,arrived_at.gte.${startOfDay.toISOString()}`)
            .order("arrived_at", { ascending: true })
            .limit(1000),
          sb
            .from("settings")
            .select(
              "standard_to_high_minutes,high_to_critical_minutes,urgent_target_minutes"
            )
            .eq("id", 1)
            .maybeSingle(),
          persona.canManageSettings
            ? sb
                .from("audit_log")
                .select("id,at,actor_name,action,detail,patient_id")
                .order("at", { ascending: false })
                .limit(200)
            : Promise.resolve(null),
        ]);
        const rows = unwrap(visits) as unknown as VisitRow[];
        const next: Partial<AppState> = { patients: rows.map(mapVisit) };
        const s = settings.data as {
          standard_to_high_minutes: number;
          high_to_critical_minutes: number;
          urgent_target_minutes: number;
        } | null;
        if (s) {
          next.settings = {
            standardToHighMinutes: s.standard_to_high_minutes,
            highToCriticalMinutes: s.high_to_critical_minutes,
            urgentTargetMinutes: s.urgent_target_minutes,
          };
        }
        if (audit && audit.data) {
          next.audit = (
            audit.data as {
              id: number;
              at: string;
              actor_name: string;
              action: string;
              detail: string;
              patient_id: string | null;
            }[]
          ).map((a) => ({
            id: String(a.id),
            at: a.at,
            actor: a.actor_name,
            action: a.action,
            detail: a.detail,
            patientId: a.patient_id ?? undefined,
          }));
        }
        set(next);
      } catch (e) {
        set({ notice: errMsg(e) });
      }
    },

    addPatient: (input) =>
      mutate(async () => {
        const id = unwrap(
          await getSupabase().rpc("register_patient", { p: input })
        );
        return id as string;
      }),

    startVisit: (patientId, input) =>
      mutate(async () => {
        const id = unwrap(
          await getSupabase().rpc("start_visit", {
            p_patient_id: patientId,
            p: input,
          })
        );
        return id as string;
      }),

    findByIdNumber: async (idNumber) => {
      try {
        const res = await getSupabase().rpc("find_patient_by_id", {
          p_id_number: idNumber,
        });
        return (unwrap(res) as string | null) ?? null;
      } catch (e) {
        set({ notice: errMsg(e) });
        return null;
      }
    },

    searchPatients: async (query) => {
      const sb = getSupabase();
      const q = query.trim();
      if (!q) return null;
      try {
        let patientId: string | null = null;
        if (/^[0-9 ]{6,}$/.test(q)) {
          patientId = await get().findByIdNumber(q);
        } else {
          const safe = q.replace(/[%,()]/g, " ");
          const res = await sb
            .from("patients")
            .select("id")
            .ilike("name", `%${safe}%`)
            .order("name")
            .limit(1);
          patientId = (unwrap(res) as { id: string }[])[0]?.id ?? null;
          get().logAudit("search", "Name search", patientId ?? undefined);
        }
        if (!patientId) return null;

        const [person, visits] = await Promise.all([
          sb.from("patients").select(PATIENT_COLS).eq("id", patientId).single(),
          sb
            .from("visits")
            .select(VISIT_SELECT)
            .eq("patient_id", patientId)
            .order("arrived_at", { ascending: false })
            .limit(1),
        ]);
        const p = unwrap(person) as {
          id: string;
          name: string;
          id_masked: string;
          contact: string;
        };
        const v = (unwrap(visits) as unknown as VisitRow[])[0];
        return {
          patientId: p.id,
          name: p.name,
          idMasked: p.id_masked,
          contact: p.contact,
          visit: v ? mapVisit(v) : null,
        };
      } catch (e) {
        set({ notice: errMsg(e) });
        return null;
      }
    },

    revealId: async (patientId) => {
      try {
        const res = await getSupabase().rpc("reveal_patient_id", {
          p_patient_id: patientId,
        });
        const full = unwrap(res) as string;
        set((s) => ({ revealedIds: { ...s.revealedIds, [patientId]: full } }));
      } catch (e) {
        set({ notice: errMsg(e) });
      }
    },

    logAudit: (action, detail, patientId, visitId) => {
      if (getConfigProblem()) return;
      void getSupabase()
        .from("audit_log")
        .insert({
          action,
          detail,
          patient_id: patientId ?? null,
          visit_id: visitId ?? null,
        })
        .then(() => undefined);
    },

    updateStatus: async (id, status) => {
      await mutate(async () =>
        unwrap(await getSupabase().from("visits").update({ status }).eq("id", id))
      );
    },

    confirmTriage: async (id, priority, overrideReason) => {
      await mutate(async () =>
        unwrap(
          await getSupabase()
            .from("visits")
            .update({
              priority,
              triage_confirmed: true,
              triage_override_reason: overrideReason || null,
            })
            .eq("id", id)
        )
      );
    },

    startConsultation: (id) => get().updateStatus(id, "with-clinician"),

    admitPatient: async (id, ward, admissionReason) => {
      await mutate(async () =>
        unwrap(
          await getSupabase()
            .from("visits")
            .update({
              status: "admitted",
              ward,
              admission_reason: admissionReason,
            })
            .eq("id", id)
        )
      );
    },

    addDosage: async (visitId, log) => {
      await mutate(async () =>
        unwrap(
          await getSupabase().from("dosage_logs").insert({
            visit_id: visitId,
            medicine: log.medicine,
            dose: log.dose,
            given_by: log.givenBy,
          })
        )
      );
    },

    addMeal: async (visitId, log) => {
      await mutate(async () =>
        unwrap(
          await getSupabase()
            .from("meal_logs")
            .insert({
              visit_id: visitId,
              meal: log.meal,
              notes: log.notes ?? null,
              ...(log.receivedAt ? { received_at: log.receivedAt } : {}),
            })
        )
      );
    },

    applyEscalations: async () => {
      try {
        const res = await getSupabase().rpc("apply_escalations");
        const n = Number(unwrap(res) ?? 0);
        if (n > 0) await get().refresh();
        return n;
      } catch {
        return 0;
      }
    },

    updateSettings: async (patch) => {
      await mutate(async () =>
        unwrap(
          await getSupabase()
            .from("settings")
            .update({
              ...(patch.standardToHighMinutes !== undefined && {
                standard_to_high_minutes: patch.standardToHighMinutes,
              }),
              ...(patch.highToCriticalMinutes !== undefined && {
                high_to_critical_minutes: patch.highToCriticalMinutes,
              }),
              ...(patch.urgentTargetMinutes !== undefined && {
                urgent_target_minutes: patch.urgentTargetMinutes,
              }),
            })
            .eq("id", 1)
        )
      );
    },

    loadStaff: async () => {
      try {
        const res = await getSupabase()
          .from("staff_profiles")
          .select("id,full_name,email,role,active")
          .order("created_at");
        const rows = unwrap(res) as ProfileRow[];
        set({
          staff: rows.map((r) => ({
            id: r.id,
            fullName: r.full_name,
            email: r.email ?? "",
            role: r.role,
            active: r.active,
          })),
        });
      } catch (e) {
        set({ notice: errMsg(e) });
      }
    },

    updateStaff: async (id, patch) => {
      try {
        unwrap(
          await getSupabase().from("staff_profiles").update(patch).eq("id", id)
        );
        await get().loadStaff();
      } catch (e) {
        set({ notice: errMsg(e) });
      }
    },

    queuePatients: () => {
      const { patients, staffRole } = get();
      const field = fieldForStaff(staffRole);
      const active = patients
        .filter(
          (p) =>
            p.status !== "admitted" &&
            p.status !== "discharged" &&
            p.status !== "awaiting-triage" &&
            (field === "all" || p.medicalField === field)
        )
        .sort(sortQueue);
      return {
        urgent: active.filter((p) => isUrgentPriority(p.priority)),
        standard: active.filter((p) => !isUrgentPriority(p.priority)),
      };
    },

    triageQueue: () =>
      get()
        .patients.filter(
          (p) =>
            !p.triageConfirmed ||
            p.status === "awaiting-triage" ||
            p.status === "in-triage"
        )
        .filter((p) => p.status !== "admitted" && p.status !== "discharged")
        .sort(sortQueue),

    admittedPatients: () =>
      get()
        .patients.filter((p) => p.status === "admitted")
        .sort(
          (a, b) =>
            new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()
        ),

    todaysPatients: () => {
      const now = new Date();
      const isToday = (iso: string) => {
        const d = new Date(iso);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      };
      return get()
        .patients.filter((p) => isToday(p.registeredAt) || isToday(p.arrivedAt))
        .sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime()
        );
    },
  };
});
