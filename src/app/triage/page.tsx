"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import { PRIORITY_LABELS, type Priority } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { formatWait, waitingMinutes } from "@/lib/utils";

export default function TriagePage() {
  const hydrated = useStoreHydrated();
  const patients = useAppStore((s) => s.patients);
  const triageQueue = useAppStore((s) => s.triageQueue);
  const confirmTriage = useAppStore((s) => s.confirmTriage);
  const persona = useAppStore((s) => s.persona);
  const [priorityById, setPriorityById] = useState<Record<string, Priority>>({});
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  void patients;

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-[var(--muted)]">
        Loading triage queue…
      </div>
    );
  }

  const queue = triageQueue().filter((p) => !p.triageConfirmed);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        Triage confirmation
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Reason for visit suggests a priority. Triage confirms or overrides with a
        recorded reason — patients cannot set their own priority.
      </p>

      {!persona?.canTriage && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sign in as triage (Dr. Thandi Dube) or Admin to confirm priorities.{" "}
          <a href="/login" className="underline">
            Sign in
          </a>
        </p>
      )}

      <section className="surface mt-8 space-y-6 rounded-2xl p-5">
        {queue.length === 0 ? (
          <p className="py-8 text-sm text-[var(--muted)]">
            No patients awaiting triage confirmation.
          </p>
        ) : (
          queue.map((p) => {
            const chosen = priorityById[p.id] ?? p.suggestedPriority;
            const override =
              chosen !== p.suggestedPriority
                ? reasonById[p.id] ?? ""
                : undefined;
            return (
              <article
                key={p.id}
                className="border-b border-[var(--line)] pb-6 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <StatusBadge status={p.status} />
                  <span className="text-xs text-[var(--muted)]">
                    Waiting {formatWait(waitingMinutes(p.arrivedAt))}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {p.reasonForVisit}
                </p>
                <p className="mt-2 text-sm">
                  Suggested: <PriorityBadge priority={p.suggestedPriority} />
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Confirm priority">
                    <Select
                      value={chosen}
                      disabled={!persona?.canTriage}
                      onChange={(e) =>
                        setPriorityById((s) => ({
                          ...s,
                          [p.id]: e.target.value as Priority,
                        }))
                      }
                    >
                      {(Object.keys(PRIORITY_LABELS) as Priority[]).map((pr) => (
                        <option key={pr} value={pr}>
                          {PRIORITY_LABELS[pr]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {chosen !== p.suggestedPriority && (
                    <Field label="Override reason (required)">
                      <Textarea
                        value={reasonById[p.id] ?? ""}
                        disabled={!persona?.canTriage}
                        onChange={(e) =>
                          setReasonById((s) => ({
                            ...s,
                            [p.id]: e.target.value,
                          }))
                        }
                        placeholder="Why is this different from the suggestion?"
                      />
                    </Field>
                  )}
                </div>
                <Button
                  type="button"
                  className="mt-3"
                  disabled={
                    !persona?.canTriage ||
                    (chosen !== p.suggestedPriority &&
                      !(reasonById[p.id] ?? "").trim())
                  }
                  onClick={() =>
                    confirmTriage(
                      p.id,
                      chosen,
                      chosen !== p.suggestedPriority
                        ? (override ?? "").trim()
                        : undefined
                    )
                  }
                >
                  Confirm triage
                </Button>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
