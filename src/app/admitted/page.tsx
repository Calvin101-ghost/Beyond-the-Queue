"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import type { MealLog } from "@/lib/types";

export default function AdmittedPage() {
  const hydrated = useStoreHydrated();
  const allPatients = useAppStore((s) => s.patients);
  const admittedPatients = useAppStore((s) => s.admittedPatients);
  const addDosage = useAppStore((s) => s.addDosage);
  const addMeal = useAppStore((s) => s.addMeal);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [medicine, setMedicine] = useState("");
  const [dose, setDose] = useState("");
  const [givenBy, setGivenBy] = useState("Sr. On duty");
  const [meal, setMeal] = useState<MealLog["meal"]>("lunch");
  const [mealNotes, setMealNotes] = useState("");
  void allPatients;

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-[var(--muted)]">
        Loading admissions…
      </div>
    );
  }

  const patients = admittedPatients();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        Hospitalised patients
      </h1>
      <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
        Separate from the waiting-room queues. Track why they are in hospital,
        daily dosages, and meals received.
      </p>

      {patients.length === 0 ? (
        <div className="surface mt-8 rounded-2xl p-8 text-center text-[var(--muted)]">
          No patients currently admitted. Admit someone from the staff queue by
          updating their status.
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {patients.map((p) => {
            const open = expanded === p.id;
            return (
              <article key={p.id} className="surface rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/patients/${p.id}`}
                        className="text-xl font-semibold text-[var(--ink)] hover:text-[var(--teal-deep)]"
                      >
                        {p.name}
                      </Link>
                      <PriorityBadge priority={p.priority} />
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {p.ward || "Ward unassigned"}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        What / admission ·{" "}
                      </span>
                      {p.admissionReason || p.reasonForVisit}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExpanded(open ? null : p.id);
                      setMedicine("");
                      setDose("");
                      setMealNotes("");
                    }}
                  >
                    {open ? "Close care log" : "Log dose / meal"}
                  </Button>
                </div>

                <div className="mt-5 grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Daily dosages
                    </h3>
                    {p.dosages.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No doses logged yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {p.dosages.map((d) => (
                          <li
                            key={d.id}
                            className="border-b border-[var(--line)] py-2 text-sm last:border-0"
                          >
                            <p className="font-medium">
                              {d.medicine} · {d.dose}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {format(new Date(d.givenAt), "d MMM · HH:mm")} ·{" "}
                              {d.givenBy}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Meals received
                    </h3>
                    {p.meals.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No meals logged yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {p.meals.map((m) => (
                          <li
                            key={m.id}
                            className="border-b border-[var(--line)] py-2 text-sm last:border-0"
                          >
                            <p className="font-medium capitalize">{m.meal}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {format(new Date(m.receivedAt), "d MMM · HH:mm")}
                              {m.notes ? ` · ${m.notes}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="mt-6 grid gap-4 border-t border-[var(--line)] pt-5 md:grid-cols-2">
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!medicine.trim() || !dose.trim()) return;
                        addDosage(p.id, {
                          medicine: medicine.trim(),
                          dose: dose.trim(),
                          givenBy: givenBy.trim() || "Staff",
                        });
                        setMedicine("");
                        setDose("");
                      }}
                    >
                      <p className="text-sm font-medium">Add dosage</p>
                      <Field label="Medicine">
                        <Input
                          value={medicine}
                          onChange={(e) => setMedicine(e.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Dose">
                        <Input
                          value={dose}
                          onChange={(e) => setDose(e.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Given by">
                        <Input
                          value={givenBy}
                          onChange={(e) => setGivenBy(e.target.value)}
                        />
                      </Field>
                      <Button type="submit" size="sm">
                        Log dosage
                      </Button>
                    </form>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addMeal(p.id, {
                          meal,
                          notes: mealNotes.trim() || undefined,
                        });
                        setMealNotes("");
                      }}
                    >
                      <p className="text-sm font-medium">Log meal received</p>
                      <Field label="Meal">
                        <Select
                          value={meal}
                          onChange={(e) =>
                            setMeal(e.target.value as MealLog["meal"])
                          }
                        >
                          <option value="breakfast">Breakfast</option>
                          <option value="lunch">Lunch</option>
                          <option value="supper">Supper</option>
                          <option value="snack">Snack</option>
                        </Select>
                      </Field>
                      <Field label="Notes">
                        <Input
                          value={mealNotes}
                          onChange={(e) => setMealNotes(e.target.value)}
                          placeholder="Ate 50%, refused, etc."
                        />
                      </Field>
                      <Button type="submit" size="sm" variant="secondary">
                        Log meal
                      </Button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
