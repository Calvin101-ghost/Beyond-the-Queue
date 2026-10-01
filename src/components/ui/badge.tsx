import { cn } from "@/lib/utils";
import type { Priority, PatientStatus } from "@/lib/types";

const priorityStyles: Record<Priority, string> = {
  critical: "bg-[var(--critical)] text-white",
  high: "bg-[var(--urgent)] text-white",
  standard: "bg-[var(--teal-soft)] text-[var(--teal-deep)]",
  low: "bg-[var(--stone)] text-[var(--ink)]",
};

const statusStyles: Record<PatientStatus, string> = {
  waiting: "bg-amber-100 text-amber-900",
  "awaiting-triage": "bg-orange-100 text-orange-900",
  "in-triage": "bg-sky-100 text-sky-900",
  "with-clinician": "bg-violet-100 text-violet-900",
  admitted: "bg-emerald-100 text-emerald-900",
  discharged: "bg-stone-200 text-stone-700",
};

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const labels = {
    critical: "Critical",
    high: "High",
    standard: "Standard",
    low: "Low",
  };
  return (
    <Badge className={priorityStyles[priority]}>{labels[priority]}</Badge>
  );
}

export function StatusBadge({ status }: { status: PatientStatus }) {
  const labels = {
    waiting: "Waiting",
    "awaiting-triage": "Awaiting triage",
    "in-triage": "In triage",
    "with-clinician": "With clinician",
    admitted: "Admitted",
    discharged: "Discharged",
  };
  return <Badge className={statusStyles[status]}>{labels[status]}</Badge>;
}
