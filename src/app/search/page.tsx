"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAppStore, type SearchResult } from "@/lib/store";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CATEGORY_LABELS, FIELD_LABELS } from "@/lib/types";

export default function SearchPage() {
  const persona = useAppStore((s) => s.persona);
  const revealedIds = useAppStore((s) => s.revealedIds);
  const revealId = useAppStore((s) => s.revealId);
  const searchPatients = useAppStore((s) => s.searchPatients);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const visit = result?.visit ?? null;
  const fullId = result ? revealedIds[result.patientId] : undefined;
  const showFullId = Boolean(fullId && persona?.canRevealId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResult(await searchPatients(query));
    setSearched(true);
    setSearching(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        Find a registered patient
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Search by ID number for patients already on file — so history is not
        trapped in a paper drawer.
      </p>

      <form
        className="surface mt-8 space-y-4 rounded-2xl p-5 sm:p-6"
        onSubmit={onSubmit}
      >
        <Field label="ID number or name">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="13-digit ID number, or part of a name"
              className="flex-1"
            />
            <Button type="submit" className="shrink-0" disabled={searching}>
              <Search className="h-4 w-4" />
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
        </Field>
        <p className="text-xs text-[var(--muted)]">
          Every search is recorded in the audit log.
        </p>
      </form>

      {searched && !result && (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-6 text-center">
          <p className="font-medium text-[var(--ink)]">No patient found</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Register them as a first-time patient so the file exists next time.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex h-10 items-center rounded-md bg-[var(--teal)] px-4 text-sm font-medium text-white"
          >
            Go to registration
          </Link>
        </div>
      )}

      {result && (
        <article className="surface mt-6 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--ink)]">
              {result.name}
            </h2>
            {visit && <PriorityBadge priority={visit.priority} />}
            {visit && <StatusBadge status={visit.status} />}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                ID number
              </dt>
              <dd className="inline-flex items-center gap-2">
                {showFullId ? fullId : result.idMasked}
                {persona?.canRevealId && !showFullId && (
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--teal-deep)] underline"
                    onClick={() => void revealId(result.patientId)}
                  >
                    Reveal
                  </button>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Contact
              </dt>
              <dd>{result.contact || "—"}</dd>
            </div>
            {visit && (
              <>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Category
                  </dt>
                  <dd>{CATEGORY_LABELS[visit.visitCategory]}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Field
                  </dt>
                  <dd>{FIELD_LABELS[visit.medicalField]}</dd>
                </div>
                {persona?.canViewClinical && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Medical history
                    </dt>
                    <dd className="text-[var(--ink-soft)]">
                      {visit.medicalHistory || "None recorded"}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>
          {visit ? (
            <Link
              href={`/patients/${visit.id}`}
              className="mt-5 inline-flex h-10 items-center rounded-md bg-[var(--teal)] px-4 text-sm font-medium text-white"
            >
              Open full profile
            </Link>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              This patient has no visit that your role can see.
            </p>
          )}
        </article>
      )}
    </div>
  );
}
