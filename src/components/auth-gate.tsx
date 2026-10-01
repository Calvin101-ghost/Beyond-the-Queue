"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

const PUBLIC_PATHS = ["/", "/login"];
const ADMIN_PATHS = ["/staff", "/audit"];

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="surface rounded-2xl p-6 sm:p-8">{children}</div>
    </div>
  );
}

export function SetupScreen({ problem }: { problem: string }) {
  return (
    <Centered>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--teal-deep)]">
        Connect your Supabase project
      </h1>
      <p className="mt-2 text-sm text-[var(--critical)]">{problem}</p>
      <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-[var(--ink-soft)]">
        <li>
          Copy <code>.env.local.example</code> to <code>.env.local</code>.
        </li>
        <li>
          Paste your <strong>Project URL</strong> and <strong>anon</strong> key
          (Supabase → Project Settings → API).
        </li>
        <li>
          Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.
        </li>
        <li>Restart the dev server, then sign up. The first account becomes admin.</li>
      </ol>
    </Centered>
  );
}

function PendingScreen() {
  const persona = useAppStore((s) => s.persona);
  const signOut = useAppStore((s) => s.signOut);
  return (
    <Centered>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--teal-deep)]">
        Waiting for access
      </h1>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        {persona?.name}, your account exists but has no role yet. Ask an
        administrator to assign you one (front desk, nurse, or a clinical
        department), then sign in again.
      </p>
      <Button className="mt-5" variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </Centered>
  );
}

function Notice() {
  const notice = useAppStore((s) => s.notice);
  const setNotice = useAppStore((s) => s.setNotice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);
  if (!notice) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg"
    >
      <p className="flex-1">{notice}</p>
      <button
        type="button"
        className="font-medium underline"
        onClick={() => setNotice(null)}
      >
        Dismiss
      </button>
    </div>
  );
}

/** Client-side route guard. The real security is Row Level Security in Postgres. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authReady = useAppStore((s) => s.authReady);
  const persona = useAppStore((s) => s.persona);
  const configProblem = useAppStore((s) => s.configProblem);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (authReady && !persona && !isPublic && !configProblem) {
      router.replace("/login");
    }
  }, [authReady, persona, isPublic, configProblem, router]);

  let body: React.ReactNode = children;
  if (!isPublic) {
    if (configProblem) body = <SetupScreen problem={configProblem} />;
    else if (!authReady || !persona)
      body = (
        <div className="mx-auto max-w-4xl px-4 py-16 text-[var(--muted)]">
          Checking your session…
        </div>
      );
    else if (persona.role === "pending") body = <PendingScreen />;
    else if (
      ADMIN_PATHS.some((p) => pathname.startsWith(p)) &&
      !persona.canManageSettings
    )
      body = (
        <Centered>
          <h1 className="text-2xl font-semibold">Administrators only</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Your role does not have access to this page.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-[var(--teal)]">
            Back to staff queue
          </Link>
        </Centered>
      );
  }
  return (
    <>
      {body}
      <Notice />
    </>
  );
}
