"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { MedicalField, VisitCategory } from "@/lib/types";
import {
  BLOOD_TYPES,
  CATEGORY_LABELS,
  FIELD_LABELS,
  PRIORITY_LABELS,
} from "@/lib/types";
import {
  defaultFieldForCategory,
  deriveFromSaId,
  suggestPriority,
} from "@/lib/logic";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PriorityBadge } from "@/components/ui/badge";

const initial = {
  name: "",
  address: "",
  idNumber: "",
  contact: "",
  email: "",
  nextOfKin: "",
  nextOfKinContact: "",
  age: "",
  gender: "female" as const,
  bloodType: "Unknown",
  medicalHistory: "",
  previousMedicine: "",
  currentMedicalStatus: "",
  reasonForVisit: "",
  visitCategory: "general" as VisitCategory,
  medicalField: "general-practice" as MedicalField,
  popiaConsent: false,
};

export default function RegisterPage() {
  const router = useRouter();
  const addPatient = useAppStore((s) => s.addPatient);
  const findByIdNumber = useAppStore((s) => s.findByIdNumber);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const suggested = useMemo(
    () => suggestPriority(form.visitCategory),
    [form.visitCategory]
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "visitCategory") {
        next.medicalField = defaultFieldForCategory(
          value as VisitCategory
        );
      }
      if (key === "idNumber") {
        const derived = deriveFromSaId(String(value));
        if (derived) {
          next.age = String(derived.age);
          next.gender = derived.gender as typeof form.gender;
        }
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const idNumber = form.idNumber.replace(/\s/g, "");
    if (!form.name.trim() || !idNumber || !form.reasonForVisit.trim()) {
      setError("Name, ID number, and reason for visit are required.");
      return;
    }
    if (!form.popiaConsent) {
      setError("POPIA consent is required before capturing the record.");
      return;
    }
    if (await findByIdNumber(idNumber)) {
      setError(
        "This ID is already registered. Use Find patient to open the profile."
      );
      return;
    }
    const age = Number(form.age);
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      setError("Enter a valid age.");
      return;
    }
    setSaving(true);
    const visitId = await addPatient({
      name: form.name.trim(),
      address: form.address.trim(),
      idNumber,
      contact: form.contact.trim(),
      email: form.email.trim(),
      nextOfKin: form.nextOfKin.trim(),
      nextOfKinContact: form.nextOfKinContact.trim(),
      age,
      gender: form.gender,
      bloodType: form.bloodType,
      medicalHistory: form.medicalHistory.trim(),
      previousMedicine: form.previousMedicine.trim(),
      currentMedicalStatus: form.currentMedicalStatus.trim(),
      reasonForVisit: form.reasonForVisit.trim(),
      visitCategory: form.visitCategory,
      medicalField: form.medicalField,
      popiaConsent: true,
    });
    setSaving(false);
    if (visitId) router.push(`/patients/${visitId}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        First-time registration
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Capture the record once. Categorised reason suggests a priority — triage
        confirms it. Patients cannot set their own urgency.
      </p>

      <form
        onSubmit={onSubmit}
        className="surface mt-8 space-y-8 rounded-2xl p-5 sm:p-8"
      >
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            General information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </Field>
            <Field label="ID number">
              <Input
                value={form.idNumber}
                onChange={(e) => set("idNumber", e.target.value)}
                placeholder="13-digit SA ID"
                required
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field label="Contact">
              <Input
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Next of kin">
              <Input
                value={form.nextOfKin}
                onChange={(e) => set("nextOfKin", e.target.value)}
              />
            </Field>
            <Field label="Next of kin contact">
              <Input
                value={form.nextOfKinContact}
                onChange={(e) => set("nextOfKinContact", e.target.value)}
              />
            </Field>
            <Field label="Age (auto from SA ID)">
              <Input
                type="number"
                min={0}
                max={120}
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                required
              />
            </Field>
            <Field label="Gender (auto from SA ID)">
              <Select
                value={form.gender}
                onChange={(e) =>
                  set("gender", e.target.value as typeof form.gender)
                }
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Medical context
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood type">
              <Select
                value={form.bloodType}
                onChange={(e) => set("bloodType", e.target.value)}
              >
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned medical field">
              <Select
                value={form.medicalField}
                onChange={(e) =>
                  set("medicalField", e.target.value as MedicalField)
                }
              >
                {(Object.keys(FIELD_LABELS) as MedicalField[]).map((f) => (
                  <option key={f} value={f}>
                    {FIELD_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Past medical history" className="sm:col-span-2">
              <Textarea
                value={form.medicalHistory}
                onChange={(e) => set("medicalHistory", e.target.value)}
              />
            </Field>
            <Field label="Previous medicine prescribed" className="sm:col-span-2">
              <Textarea
                value={form.previousMedicine}
                onChange={(e) => set("previousMedicine", e.target.value)}
              />
            </Field>
            <Field label="Current medical status" className="sm:col-span-2">
              <Textarea
                value={form.currentMedicalStatus}
                onChange={(e) => set("currentMedicalStatus", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Today&apos;s visit · suggested triage
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason for visit" className="sm:col-span-2">
              <Textarea
                value={form.reasonForVisit}
                onChange={(e) => set("reasonForVisit", e.target.value)}
                required
              />
            </Field>
            <Field label="Reason category">
              <Select
                value={form.visitCategory}
                onChange={(e) =>
                  set("visitCategory", e.target.value as VisitCategory)
                }
              >
                {(Object.keys(CATEGORY_LABELS) as VisitCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Suggested priority (triage confirms)
              </p>
              <div className="flex h-10 items-center gap-2">
                <PriorityBadge priority={suggested} />
                <span className="text-sm text-[var(--ink-soft)]">
                  {PRIORITY_LABELS[suggested]}
                </span>
              </div>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--teal)]"
              checked={form.popiaConsent}
              onChange={(e) => set("popiaConsent", e.target.checked)}
            />
            Patient (or guardian) consents to processing of personal and health
            information under POPIA for care and queue management.
          </label>
        </section>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={saving}>
          {saving ? "Saving…" : "Capture record & send to triage"}
        </Button>
      </form>
    </div>
  );
}
