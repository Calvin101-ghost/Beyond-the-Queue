"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { StaffRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { SetupScreen } from "@/components/auth-gate";

function homeFor(role: StaffRole): string {
  if (role === "nurse") return "/triage";
  if (role === "admin") return "/staff";
  if (role === "front-desk") return "/search";
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const configProblem = useAppStore((s) => s.configProblem);
  const persona = useAppStore((s) => s.persona);
  const signIn = useAppStore((s) => s.signIn);
  const signUp = useAppStore((s) => s.signUp);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (persona && persona.role !== "pending") router.replace(homeFor(persona.role));
  }, [persona, router]);

  if (configProblem) return <SetupScreen problem={configProblem} />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    if (mode === "in") {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
    } else {
      if (!name.trim()) {
        setError("Enter your full name.");
        setBusy(false);
        return;
      }
      const res = await signUp(email.trim(), password, name.trim());
      if (res.error) setError(res.error);
      else if (res.needsConfirmation)
        setInfo(
          "Account created. Check your email to confirm it, then sign in. (Tip: turn off email confirmation in Supabase → Authentication → Providers → Email for a faster setup.)"
        );
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--teal-deep)]">
        {mode === "in" ? "Staff sign-in" : "Create staff account"}
      </h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        {mode === "in"
          ? "Use the email and password for your staff account."
          : "The first account created becomes the administrator. Later accounts wait for an admin to assign a role."}
      </p>

      {persona?.role === "pending" && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You are signed in as {persona.name}, but an administrator still needs
          to assign your role.
        </p>
      )}

      <form onSubmit={onSubmit} className="surface mt-8 space-y-4 rounded-2xl p-5 sm:p-6">
        {mode === "up" && (
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        )}
        {info && (
          <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">{info}</p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-[var(--ink-soft)]">
        {mode === "in" ? "New staff member?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-[var(--teal-deep)] underline"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError("");
            setInfo("");
          }}
        >
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
