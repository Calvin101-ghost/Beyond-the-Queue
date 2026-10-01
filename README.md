# Beyond Queue — Patient Flow & Records

Priority-based patient journey tool for congested South African hospitals and clinics.

Built from the original handwritten notes (registration, categorised reason → priority,
staff field queues, admitted care logs) plus the stronger MVP ideas in the uploaded
proposal README: personas, triage confirmation, auto-escalation, POPIA-minded ID masking,
audit trail, and pilot metrics.

## What it does

- **Staff accounts with roles** — front desk, nurse/triage, clinical departments, admin
- **First-time registration** — demographics, medical history, POPIA consent, SA ID age/gender hint
- **Suggested priority from visit category** — triage confirms or overrides with a reason
- **ID search** with masked numbers (reveal is permission-gated and audited)
- **Staff queue** — urgent vs standard lists, department filter, live waits, escalation badges
- **Automatic escalation** — standard/low → high after 90m; high → critical after 45m (configurable)
- **Pilot metrics** — median wait, median first contact, urgent-on-time %, escalated count
- **Admitted page** — ward, dosages, meals
- **Audit log** — every search, open, triage, dose, escalation
- **Settings** — escalation thresholds (Admin)

Data now lives in **Supabase** (Postgres + Auth + Realtime) with Row Level Security.
Nothing patient-related is stored in the browser.


```

Then open **Sign in → Create an account**. The first account becomes the
administrator; everyone after that has no access until an admin gives them a
role on the **Staff** page.

Notes:
- To stop a stranger claiming the admin role first, run this *before* signing up:
  `update public.settings set bootstrap_admin_email = 'you@example.com' where id = 1;`
  Once your admin exists, you can also switch off public sign-ups in
  Authentication → Providers → Email and add staff by invitation.
- If sign-up asks you to confirm your email, either click the link or turn off
  "Confirm email" in Authentication → Providers → Email for local development.
- Automatic escalation runs in the database. `schema.sql` schedules it every
  minute with `pg_cron` if that extension is enabled; otherwise any open
  dashboard triggers it every 30 seconds.

## What the database enforces (Row Level Security)

| Rule | Where |
|---|---|
| No access until an admin assigns a role | `is_staff()` in every policy |
| Clinicians only see visits in their own department | `visits` policy via `can_see_field()` |
| Front desk cannot read medical history, doses or meals | `patient_clinical`, `dosage_logs`, `meal_logs` policies |
| Full ID number is unreadable through the API; masked everywhere; reveal is clinical-only and audited | column privileges + `reveal_patient_id()` |
| Only triage nurses/admins can set or change priority; overrides need a reason | `visits_guard` trigger |
| Priority is suggested server-side from the visit category; arrival time cannot be backdated | `visits_guard` trigger |
| Escalation never downgrades; time at each level counts from the last escalation | `apply_escalations()` |
| Audit log is append-only, attributed to the signed-in user, readable by admins only | `audit_log` policies + triggers |
| Dosage and meal logs cannot be edited or deleted | no update/delete policies |
| Only admins change settings and roles; the last admin cannot be removed | policies + `staff_guard` trigger |

## How the frontend maps to the schema

| Frontend concept | Tables |
|---|---|
| Patient demographics | `patients` |
| Past history, previous medicine, blood type, current status | `patient_clinical` |
| Reason, category, priority, status, ward (one row per visit) | `visits` |
| Daily dosages / meals received | `dosage_logs`, `meal_logs` |
| Audit page | `audit_log` |
| Escalation settings | `settings` |
| Staff sign-in and roles | Supabase Auth + `staff_profiles` |

A returning patient who has been discharged gets a **Start a new visit** form on
their profile, so history stays attached to one person.

## Walkthrough (after running seed.sql)

1. Sign up (admin) → **Staff** → create more accounts and give them roles:
   Front desk, Nurse / triage, and a clinical department such as Emergency.
2. As **front desk**: Find patient `9203155800083` (masked ID); register a new patient.
3. As **nurse**: Triage → confirm or override priorities (overrides need a reason).
4. **Staff queue**: urgent vs standard lists, escalation badges, metrics strip.
   Sign in as a clinician to see only that department.
5. **Admitted** → log a dose for Vusi Khumalo.
6. As **admin**: **Audit** shows every search, open, triage, dose and escalation;
   **Settings** changes the escalation minutes for everyone.

## Note on the uploaded Vite files

The files you uploaded (`package.json`, `index.html`, `tsconfig.json`, README) describe a
separate Dexie/PWA Vite MVP. Only those config/docs were present — not the full Vite
`src/` tree — so improvements were applied to this working Next.js app instead.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Zustand, Supabase (Postgres, Auth, Realtime).

Before real patient data: choose a South Africa region for the Supabase project, enable
MFA for staff, review POPIA obligations with a legal adviser, and run a security review.
