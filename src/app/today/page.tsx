"use client";

import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import { PatientQueueCard } from "@/components/patient-queue-card";

export default function TodayPage() {
  const hydrated = useStoreHydrated();
  const allPatients = useAppStore((s) => s.patients);
  const todaysPatients = useAppStore((s) => s.todaysPatients);
  void allPatients;

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-[var(--muted)]">
        Loading today&apos;s log…
      </div>
    );
  }

  const patients = todaysPatients();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        All patients logged for today
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Everyone who arrived or was registered today — priority first — for
        front desk and medical staff.
      </p>

      <section className="surface mt-8 rounded-2xl p-5">
        {patients.length === 0 ? (
          <p className="py-8 text-sm text-[var(--muted)]">
            No patients logged for today yet. Register someone to start the day.
          </p>
        ) : (
          patients.map((p) => (
            <PatientQueueCard key={p.id} patient={p} showActions={false} />
          ))
        )}
      </section>
    </div>
  );
}
