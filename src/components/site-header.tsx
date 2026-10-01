"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BedDouble,
  ClipboardPlus,
  FileText,
  LayoutDashboard,
  LogIn,
  Search,
  Settings,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

const links: {
  href: string;
  label: string;
  icon: typeof Activity;
  auth?: "in" | "out" | "admin";
}[] = [
  { href: "/", label: "Home", icon: Activity },
  { href: "/login", label: "Sign in", icon: LogIn, auth: "out" },
  { href: "/register", label: "Register", icon: ClipboardPlus, auth: "in" },
  { href: "/search", label: "Find patient", icon: Search, auth: "in" },
  { href: "/triage", label: "Triage", icon: Stethoscope, auth: "in" },
  { href: "/dashboard", label: "Staff queue", icon: LayoutDashboard, auth: "in" },
  { href: "/admitted", label: "Admitted", icon: BedDouble, auth: "in" },
  { href: "/today", label: "Today", icon: Users, auth: "in" },
  { href: "/audit", label: "Audit", icon: FileText, auth: "admin" },
  { href: "/settings", label: "Settings", icon: Settings, auth: "in" },
  { href: "/staff", label: "Staff", icon: UserCog, auth: "admin" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const persona = useAppStore((s) => s.persona);
  const signOut = useAppStore((s) => s.signOut);
  const visibleLinks = links.filter((l) => {
    if (l.auth === "out") return !persona;
    if (l.auth === "in") return Boolean(persona) && persona?.role !== "pending";
    if (l.auth === "admin") return Boolean(persona?.canManageSettings);
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--teal-deep)] sm:text-3xl">
              Beyond Queue
            </span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
              Patient flow
            </span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {persona ? (
              <div className="text-right text-xs leading-tight">
                <p className="font-semibold text-[var(--ink)]">{persona.name}</p>
                <p className="text-[var(--muted)]">{persona.title}</p>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--teal-deep)]"
              >
                Sign in
              </Link>
            )}
            {persona && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            )}
          </div>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--teal)] text-white"
                    : "text-[var(--ink-soft)] hover:bg-black/5 hover:text-[var(--ink)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
