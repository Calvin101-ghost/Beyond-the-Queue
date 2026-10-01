import Link from "next/link";
import { ArrowRight, ClipboardList, HeartPulse, Timer } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      <section className="hero-grid relative overflow-hidden border-b border-[var(--line)]">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full max-w-xl bg-[radial-gradient(circle_at_70%_40%,rgba(15,118,110,0.22),transparent_60%)]" />
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl animate-rise">
            <p className="mb-3 font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-[var(--teal-deep)] sm:text-6xl md:text-7xl">
              Beyond Queue
            </p>
            <h1 className="max-w-xl text-2xl font-medium leading-snug text-[var(--ink)] sm:text-3xl">
              Rethink the patient journey when every minute in the waiting room
              matters.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--ink-soft)]">
              Built for South African hospitals and clinics drowning in
              congestion: triage by urgency, keep medical history findable, and
              stop critical patients getting lost behind first-come queues.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--teal)] px-5 text-base font-medium text-white shadow-sm transition hover:bg-[var(--teal-deep)]"
              >
                Staff sign-in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--line)] bg-white/70 px-5 text-base font-medium text-[var(--ink)] transition hover:bg-white"
              >
                Open staff queue
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--line)] bg-white/70 px-5 text-base font-medium text-[var(--ink)] transition hover:bg-white"
              >
                Register a patient
              </Link>
            </div>
          </div>
          <div className="animate-rise-delay surface max-w-sm rounded-2xl p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              <span className="live-dot h-2 w-2 rounded-full bg-[var(--critical)]" />
              Live triage logic
            </div>
            <ul className="space-y-3 text-sm text-[var(--ink-soft)]">
              <li className="flex gap-3">
                <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-[var(--critical)]" />
                Critical and high-priority patients rise to the top — never
                buried behind routine visits.
              </li>
              <li className="flex gap-3">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-[var(--urgent)]" />
                Waiting time is visible so quick interventions are not delayed
                by unmanaged flow.
              </li>
              <li className="flex gap-3">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[var(--teal)]" />
                ID search and digital profiles replace fragile paper filing.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--teal-deep)]">
          The problems this day solves
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Unnecessary congestion and poor patient management create avoidable
          harm. Beyond Queue turns your handoff notes into a working flow.
        </p>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Immediate care first",
              body: "Patients who need attention now are compelled to wait less — priority levels and split urgent/standard lists keep them visible.",
            },
            {
              n: "02",
              title: "Protect working hours",
              body: "Quick interventions still get a place in the queue with tracked wait times, so treatable cases are not stuck all day.",
            },
            {
              n: "03",
              title: "History that travels",
              body: "Search by ID, open the profile, see past medicine and status — less wrongful care from a lost file.",
            },
          ].map((item) => (
            <div key={item.n} className="border-t border-[var(--line)] pt-4">
              <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted)]">
                {item.n}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
