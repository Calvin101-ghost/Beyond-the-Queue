"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useStoreHydrated } from "@/components/store-hydration";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import Link from "next/link";

export default function SettingsPage() {
  const hydrated = useStoreHydrated();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const persona = useAppStore((s) => s.persona);
  // Edits are kept as a draft; until the user types, the form mirrors live settings.
  const [draft, setDraft] = useState<typeof settings | null>(null);
  const form = draft ?? settings;
  const setForm = (fn: (f: typeof settings) => typeof settings) =>
    setDraft(fn(draft ?? settings));
  const [saved, setSaved] = useState(false);


  if (!hydrated) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-[var(--muted)]">
        Loading settings…
      </div>
    );
  }

  const canEdit = Boolean(persona?.canManageSettings);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        Escalation settings
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Automatic escalation never downgrades a patient. Long waits promote
        standard → high, then high → critical.
      </p>
      {!canEdit && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sign in as Admin to change thresholds.{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      )}

      <form
        className="surface mt-8 space-y-4 rounded-2xl p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canEdit) return;
          await updateSettings({
            standardToHighMinutes: Number(form.standardToHighMinutes),
            highToCriticalMinutes: Number(form.highToCriticalMinutes),
            urgentTargetMinutes: Number(form.urgentTargetMinutes),
          });
          setDraft(null);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
      >
        <Field label="Standard/low → high after (minutes)">
          <Input
            type="number"
            min={5}
            disabled={!canEdit}
            value={form.standardToHighMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                standardToHighMinutes: Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="High → critical after (minutes)">
          <Input
            type="number"
            min={5}
            disabled={!canEdit}
            value={form.highToCriticalMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                highToCriticalMinutes: Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="Urgent target time (minutes)">
          <Input
            type="number"
            min={5}
            disabled={!canEdit}
            value={form.urgentTargetMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                urgentTargetMinutes: Number(e.target.value),
              }))
            }
          />
        </Field>
        <Button type="submit" disabled={!canEdit}>
          Save settings
        </Button>
        {saved && (
          <p className="text-sm text-[var(--teal-deep)]">Saved and audited.</p>
        )}
      </form>
    </div>
  );
}
