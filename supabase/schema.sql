-- =====================================================================
-- Beyond Queue: Supabase schema with Row Level Security
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query.
-- It is safe to re-run (idempotent).
--
-- OPTIONAL, before the first sign-up: pin the first admin to your email
-- so nobody else can claim the admin role. Run this BEFORE you sign up:
--   update public.settings set bootstrap_admin_email = 'you@example.com' where id = 1;
-- (If you skip it, the first account that signs up becomes admin.)
-- =====================================================================

-- ---------- Enums ----------------------------------------------------
do $$ begin create type public.staff_role as enum
  ('pending','front-desk','nurse','admin','emergency','general-practice',
   'cardiology','paediatrics','obstetrics','orthopaedics','internal-medicine');
exception when duplicate_object then null; end $$;
do $$ begin create type public.medical_field as enum
  ('emergency','general-practice','cardiology','paediatrics','obstetrics',
   'orthopaedics','internal-medicine');
exception when duplicate_object then null; end $$;
do $$ begin create type public.priority_level as enum ('critical','high','standard','low');
exception when duplicate_object then null; end $$;
do $$ begin create type public.visit_category as enum
  ('emergency','injury','chronic-care','maternity','paediatrics','general','follow-up');
exception when duplicate_object then null; end $$;
do $$ begin create type public.patient_status as enum
  ('waiting','awaiting-triage','in-triage','with-clinician','admitted','discharged');
exception when duplicate_object then null; end $$;
do $$ begin create type public.gender_type as enum ('female','male','other','prefer-not-to-say');
exception when duplicate_object then null; end $$;
do $$ begin create type public.meal_type as enum ('breakfast','lunch','supper','snack');
exception when duplicate_object then null; end $$;

create extension if not exists pg_trgm;

-- ---------- Tables ---------------------------------------------------
create table if not exists public.staff_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  role        public.staff_role not null default 'pending',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.settings (
  id                        int primary key default 1 check (id = 1),
  standard_to_high_minutes  int not null default 90 check (standard_to_high_minutes >= 5),
  high_to_critical_minutes  int not null default 45 check (high_to_critical_minutes >= 5),
  urgent_target_minutes     int not null default 60 check (urgent_target_minutes >= 5),
  bootstrap_admin_email     text,
  updated_at                timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Permanent person record (demographics). id_number is NOT readable by the API.
create table if not exists public.patients (
  id                  uuid primary key default gen_random_uuid(),
  id_number           text not null unique check (length(id_number) between 5 and 20),
  id_masked           text generated always as (
                        case when length(id_number) < 7 then '••••••••'
                             else left(id_number, 6) || '••••' || right(id_number, 3) end
                      ) stored,
  name                text not null check (length(trim(name)) > 0),
  address             text not null default '',
  contact             text not null default '',
  email               text not null default '',
  next_of_kin         text not null default '',
  next_of_kin_contact text not null default '',
  age                 int  not null check (age between 0 and 120),  -- age at registration
  gender              public.gender_type not null default 'female',
  popia_consent       boolean not null default false check (popia_consent),
  popia_consent_at    timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists patients_name_trgm on public.patients using gin (name gin_trgm_ops);

-- Clinical history lives in its own table so RLS can hide it from reception.
create table if not exists public.patient_clinical (
  patient_id             uuid primary key references public.patients(id) on delete cascade,
  blood_type             text not null default 'Unknown',
  medical_history        text not null default '',
  previous_medicine      text not null default '',
  current_medical_status text not null default '',
  updated_at             timestamptz not null default now()
);

-- One row per visit / episode of care.
create table if not exists public.visits (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients(id) on delete restrict,
  reason_for_visit      text not null check (length(trim(reason_for_visit)) > 0),
  visit_category        public.visit_category not null default 'general',
  medical_field         public.medical_field not null default 'general-practice',
  suggested_priority    public.priority_level not null,
  priority              public.priority_level not null,
  triage_confirmed      boolean not null default false,
  triage_override_reason text,
  triaged_by            uuid,
  escalated             boolean not null default false,
  escalated_from        public.priority_level,
  escalated_at          timestamptz,
  status                public.patient_status not null default 'awaiting-triage',
  arrived_at            timestamptz not null default now(),
  first_contact_at      timestamptz,
  ward                  text,
  admission_reason      text,
  admitted_at           timestamptz,
  discharged_at         timestamptz,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists visits_status_idx  on public.visits (status);
create index if not exists visits_field_idx   on public.visits (medical_field);
create index if not exists visits_patient_idx on public.visits (patient_id, arrived_at desc);
create index if not exists visits_arrived_idx on public.visits (arrived_at);
-- A patient can only have one open visit at a time.
create unique index if not exists visits_one_open_per_patient
  on public.visits (patient_id) where status <> 'discharged';

create table if not exists public.dosage_logs (
  id        uuid primary key default gen_random_uuid(),
  visit_id  uuid not null references public.visits(id) on delete cascade,
  medicine  text not null check (length(trim(medicine)) > 0),
  dose      text not null check (length(trim(dose)) > 0),
  given_by  text not null default 'Staff',
  given_at  timestamptz not null default now(),
  logged_by uuid default auth.uid()
);
create index if not exists dosage_visit_idx on public.dosage_logs (visit_id, given_at desc);

create table if not exists public.meal_logs (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits(id) on delete cascade,
  meal        public.meal_type not null,
  notes       text,
  received_at timestamptz not null default now(),
  logged_by   uuid default auth.uid()
);
create index if not exists meal_visit_idx on public.meal_logs (visit_id, received_at desc);

-- Append-only audit trail (POPIA accountability).
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_name text not null default 'System',
  action     text not null,
  detail     text not null default '',
  patient_id uuid,
  visit_id   uuid
);
create index if not exists audit_at_idx on public.audit_log (at desc);

-- ---------- Role helper functions -----------------------------------
create or replace function public.app_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff_profiles where id = auth.uid() and active
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() <> 'pending', false)
$$;
create or replace function public.can_view_clinical() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role()::text not in ('pending','front-desk'), false)
$$;
create or replace function public.can_triage() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role()::text in ('nurse','admin'), false)
$$;
create or replace function public.can_manage() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false)
$$;
create or replace function public.can_see_field(f public.medical_field) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role()::text in ('front-desk','nurse','admin'), false)
      or coalesce(public.app_role()::text = f::text, false)
$$;

create or replace function public.suggest_priority(c public.visit_category)
returns public.priority_level language sql immutable as $$
  select (case c when 'emergency' then 'critical'
                 when 'maternity' then 'high' when 'paediatrics' then 'high'
                 when 'injury' then 'high' when 'chronic-care' then 'high'
                 when 'follow-up' then 'standard' else 'low' end)::public.priority_level
$$;

-- ---------- Audit plumbing ------------------------------------------
create or replace function public.audit_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.at := now();
  new.actor_id := auth.uid();
  new.actor_name := coalesce(
    (select coalesce(nullif(full_name, ''), email, 'Staff') || ' (' || role::text || ')'
       from public.staff_profiles where id = auth.uid()), 'System');
  return new;
end $$;
drop trigger if exists audit_stamp_trg on public.audit_log;
create trigger audit_stamp_trg before insert on public.audit_log
  for each row execute function public.audit_stamp();

create or replace function public.write_audit(p_action text, p_detail text, p_patient uuid, p_visit uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (action, detail, patient_id, visit_id)
  values (p_action, p_detail, p_patient, p_visit);
end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['patients','patient_clinical','visits','settings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- Visit rules (server-side, cannot be bypassed by the UI) --
create or replace function public.visits_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.staff_role := public.app_role();
  is_system boolean := auth.uid() is null or coalesce(current_setting('app.system', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    new.suggested_priority := public.suggest_priority(new.visit_category);
    new.priority := coalesce(new.priority, new.suggested_priority);
    if not is_system then
      new.arrived_at := now();
      new.escalated := false; new.escalated_from := null; new.escalated_at := null;
      if not public.can_triage() then
        -- reception / patients can never set their own priority
        new.priority := new.suggested_priority;
        new.triage_confirmed := false;
        new.triage_override_reason := null;
        if new.status not in ('awaiting-triage','waiting') then new.status := 'awaiting-triage'; end if;
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if not is_system then
    new.patient_id := old.patient_id;
    new.arrived_at := old.arrived_at;
    new.suggested_priority := old.suggested_priority;
    new.escalated := old.escalated; new.escalated_from := old.escalated_from; new.escalated_at := old.escalated_at;

    if (new.priority, new.triage_confirmed, new.triage_override_reason)
       is distinct from (old.priority, old.triage_confirmed, old.triage_override_reason)
       and not public.can_triage() then
      raise exception 'Only triage staff can set or change priority.' using errcode = '42501';
    end if;
  end if;

  if new.triage_confirmed and not old.triage_confirmed then
    if new.priority <> new.suggested_priority and coalesce(trim(new.triage_override_reason), '') = '' then
      raise exception 'An override reason is required when changing the suggested priority.';
    end if;
    new.triaged_by := auth.uid();
    if new.status = 'awaiting-triage' then new.status := 'waiting'; end if;
  end if;

  if new.status is distinct from old.status then
    if not is_system and r = 'front-desk' and new.status not in ('waiting','awaiting-triage','in-triage') then
      raise exception 'Front desk cannot set status to %.', new.status using errcode = '42501';
    end if;
    if new.status in ('in-triage','with-clinician') and new.first_contact_at is null then
      new.first_contact_at := now();
    end if;
    if new.status = 'admitted' then
      new.admitted_at := coalesce(new.admitted_at, now());
      new.ward := coalesce(nullif(trim(new.ward), ''), 'General Ward');
    end if;
    if new.status = 'discharged' then new.discharged_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists visits_guard_trg on public.visits;
create trigger visits_guard_trg before insert or update on public.visits
  for each row execute function public.visits_guard();

create or replace function public.visits_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('visit', format('Visit opened, suggested %s', new.suggested_priority), new.patient_id, new.id);
    return null;
  end if;
  if new.escalated_at is distinct from old.escalated_at then
    perform public.write_audit('escalate', format('Auto-escalated %s → %s', old.priority, new.priority), new.patient_id, new.id);
  elsif new.priority is distinct from old.priority or new.triage_confirmed is distinct from old.triage_confirmed then
    perform public.write_audit('triage',
      case when new.priority <> new.suggested_priority
           then format('override %s → %s (%s)', new.suggested_priority, new.priority, new.triage_override_reason)
           else format('confirmed %s', new.priority) end, new.patient_id, new.id);
  end if;
  if new.status is distinct from old.status then
    if new.status = 'admitted' then
      perform public.write_audit('admit', format('Admitted to %s: %s', new.ward, coalesce(new.admission_reason, new.reason_for_visit)), new.patient_id, new.id);
    else
      perform public.write_audit('status', format('Status → %s', new.status), new.patient_id, new.id);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists visits_audit_trg on public.visits;
create trigger visits_audit_trg after insert or update on public.visits
  for each row execute function public.visits_audit();

create or replace function public.patients_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(case when tg_op = 'INSERT' then 'register' else 'update' end,
    case when tg_op = 'INSERT' then format('Registered %s', new.name) else format('Updated demographics for %s', new.name) end,
    new.id, null);
  return null;
end $$;
drop trigger if exists patients_audit_trg on public.patients;
create trigger patients_audit_trg after insert or update on public.patients
  for each row execute function public.patients_audit();

create or replace function public.care_logs_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select patient_id into pid from public.visits where id = new.visit_id;
  if tg_table_name = 'dosage_logs' then
    perform public.write_audit('dosage', format('%s %s by %s', new.medicine, new.dose, new.given_by), pid, new.visit_id);
  else
    perform public.write_audit('meal', format('Recorded %s', new.meal), pid, new.visit_id);
  end if;
  return null;
end $$;
drop trigger if exists dosage_audit_trg on public.dosage_logs;
create trigger dosage_audit_trg after insert on public.dosage_logs for each row execute function public.care_logs_audit();
drop trigger if exists meal_audit_trg on public.meal_logs;
create trigger meal_audit_trg after insert on public.meal_logs for each row execute function public.care_logs_audit();

create or replace function public.settings_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit('settings', format('Escalation settings: standard→high %sm, high→critical %sm, urgent target %sm',
    new.standard_to_high_minutes, new.high_to_critical_minutes, new.urgent_target_minutes), null, null);
  return null;
end $$;
drop trigger if exists settings_audit_trg on public.settings;
create trigger settings_audit_trg after update on public.settings for each row execute function public.settings_audit();

-- ---------- Staff accounts ------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare boot text; make_admin boolean;
begin
  select bootstrap_admin_email into boot from public.settings where id = 1;
  make_admin := not exists (select 1 from public.staff_profiles where role = 'admin' and active)
                and (boot is null or boot = '' or lower(boot) = lower(new.email));
  insert into public.staff_profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          (case when make_admin then 'admin' else 'pending' end)::public.staff_role)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Never allow the last active admin to be demoted or deactivated.
create or replace function public.staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.staff_profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'At least one active admin is required.';
  end if;
  if new.role is distinct from old.role then
    perform public.write_audit('staff', format('Role of %s changed %s → %s', coalesce(nullif(new.full_name, ''), new.email), old.role, new.role), null, null);
  end if;
  return new;
end $$;
drop trigger if exists staff_guard_trg on public.staff_profiles;
create trigger staff_guard_trg before update on public.staff_profiles
  for each row execute function public.staff_guard();

-- ---------- RPCs used by the app ------------------------------------
-- Look up a patient by full ID number (the column itself is not readable).
create or replace function public.find_patient_by_id(p_id_number text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; clean text := regexp_replace(coalesce(p_id_number, ''), '\s', '', 'g');
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select id into pid from public.patients where id_number = clean;
  perform public.write_audit('search',
    case when pid is null then 'ID search: no match' else 'ID search: match' end, pid, null);
  return pid;
end $$;

-- Reveal the full ID number. Clinical roles only, always audited.
create or replace function public.reveal_patient_id(p_patient_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not public.can_view_clinical() then raise exception 'Not allowed to reveal ID numbers' using errcode = '42501'; end if;
  select id_number into v from public.patients where id = p_patient_id;
  perform public.write_audit('reveal-id', 'Unmasked patient ID number', p_patient_id, null);
  return v;
end $$;

-- Atomic first-time registration: patient + clinical history + first visit.
create or replace function public.register_patient(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare pid uuid; vid uuid;
begin
  insert into public.patients (id_number, name, address, contact, email, next_of_kin,
                               next_of_kin_contact, age, gender, popia_consent)
  values (regexp_replace(coalesce(p ->> 'idNumber', ''), '\s', '', 'g'), trim(p ->> 'name'),
          coalesce(p ->> 'address', ''), coalesce(p ->> 'contact', ''), coalesce(p ->> 'email', ''),
          coalesce(p ->> 'nextOfKin', ''), coalesce(p ->> 'nextOfKinContact', ''),
          (p ->> 'age')::int, coalesce(p ->> 'gender', 'female')::public.gender_type,
          coalesce((p ->> 'popiaConsent')::boolean, false))
  returning id into pid;
  insert into public.patient_clinical (patient_id, blood_type, medical_history, previous_medicine, current_medical_status)
  values (pid, coalesce(p ->> 'bloodType', 'Unknown'), coalesce(p ->> 'medicalHistory', ''),
          coalesce(p ->> 'previousMedicine', ''), coalesce(p ->> 'currentMedicalStatus', ''));
  insert into public.visits (patient_id, reason_for_visit, visit_category, medical_field)
  values (pid, p ->> 'reasonForVisit', (p ->> 'visitCategory')::public.visit_category,
          (p ->> 'medicalField')::public.medical_field)
  returning id into vid;
  return vid;
end $$;

-- New visit for an already-registered patient.
create or replace function public.start_visit(p_patient_id uuid, p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare vid uuid;
begin
  insert into public.visits (patient_id, reason_for_visit, visit_category, medical_field)
  values (p_patient_id, p ->> 'reasonForVisit', (p ->> 'visitCategory')::public.visit_category,
          (p ->> 'medicalField')::public.medical_field)
  returning id into vid;
  return vid;
end $$;

-- Server-side auto-escalation. Never downgrades. Time at the current level is
-- measured from the last escalation (or arrival), so a patient promoted to
-- "high" gets a full high->critical window before the next promotion.
create or replace function public.apply_escalations() returns int
language plpgsql security definer set search_path = public as $$
declare s public.settings; n int;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into s from public.settings where id = 1;
  perform set_config('app.system', '1', true);
  with up as (
    update public.visits v
       set priority = (case when v.priority in ('standard','low') then 'high' else 'critical' end)::public.priority_level,
           escalated = true, escalated_from = v.priority, escalated_at = now()
     where v.status not in ('admitted','discharged','with-clinician')
       and ((v.priority in ('standard','low')
             and now() - coalesce(v.escalated_at, v.arrived_at) >= make_interval(mins => s.standard_to_high_minutes))
         or (v.priority = 'high'
             and now() - coalesce(v.escalated_at, v.arrived_at) >= make_interval(mins => s.high_to_critical_minutes)))
    returning 1)
  select count(*) into n from up;
  perform set_config('app.system', '0', true);
  return n;
end $$;

-- ---------- Privileges ----------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

grant select on public.staff_profiles, public.visits, public.patient_clinical,
                public.dosage_logs, public.meal_logs, public.audit_log to authenticated;
grant select (id, standard_to_high_minutes, high_to_critical_minutes, urgent_target_minutes, updated_at)
      on public.settings to authenticated;
grant select (id, id_masked, name, address, contact, email, next_of_kin, next_of_kin_contact,
              age, gender, popia_consent, created_at, updated_at) on public.patients to authenticated;
grant insert (id_number, name, address, contact, email, next_of_kin, next_of_kin_contact,
              age, gender, popia_consent) on public.patients to authenticated;
grant update (name, address, contact, email, next_of_kin, next_of_kin_contact, age, gender)
      on public.patients to authenticated;
grant insert, update on public.patient_clinical to authenticated;
grant insert (patient_id, reason_for_visit, visit_category, medical_field, status, priority,
              triage_confirmed, triage_override_reason) on public.visits to authenticated;
grant update (status, priority, triage_confirmed, triage_override_reason, ward, admission_reason,
              medical_field, visit_category, reason_for_visit) on public.visits to authenticated;
grant insert (visit_id, medicine, dose, given_by) on public.dosage_logs to authenticated;
grant insert (visit_id, meal, notes, received_at) on public.meal_logs to authenticated;
grant insert (action, detail, patient_id, visit_id) on public.audit_log to authenticated;
grant update (full_name, role, active) on public.staff_profiles to authenticated;
grant update (standard_to_high_minutes, high_to_critical_minutes, urgent_target_minutes)
      on public.settings to authenticated;

grant execute on function
  public.app_role(), public.is_staff(), public.can_view_clinical(), public.can_triage(),
  public.can_manage(), public.can_see_field(public.medical_field), public.suggest_priority(public.visit_category),
  public.find_patient_by_id(text), public.reveal_patient_id(uuid), public.register_patient(jsonb),
  public.start_visit(uuid, jsonb), public.apply_escalations()
  to authenticated;

-- ---------- Row Level Security --------------------------------------
alter table public.staff_profiles  enable row level security;
alter table public.settings        enable row level security;
alter table public.patients        enable row level security;
alter table public.patient_clinical enable row level security;
alter table public.visits          enable row level security;
alter table public.dosage_logs     enable row level security;
alter table public.meal_logs       enable row level security;
alter table public.audit_log       enable row level security;

-- staff_profiles: see yourself; admins see and manage everyone
drop policy if exists staff_select on public.staff_profiles;
create policy staff_select on public.staff_profiles for select to authenticated
  using (id = auth.uid() or (select public.can_manage()));
drop policy if exists staff_update on public.staff_profiles;
create policy staff_update on public.staff_profiles for update to authenticated
  using ((select public.can_manage())) with check ((select public.can_manage()));

-- settings: every staff member reads, only admin writes
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated
  using ((select public.is_staff()));
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated
  using ((select public.can_manage())) with check ((select public.can_manage()));

-- patients: all active staff (ID number column is blocked at privilege level)
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients for select to authenticated
  using ((select public.is_staff()));
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients for insert to authenticated
  with check ((select public.is_staff()));
drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- patient_clinical: reception can write at registration but never read
drop policy if exists clinical_select on public.patient_clinical;
create policy clinical_select on public.patient_clinical for select to authenticated
  using ((select public.can_view_clinical()));
drop policy if exists clinical_insert on public.patient_clinical;
create policy clinical_insert on public.patient_clinical for insert to authenticated
  with check ((select public.is_staff()));
drop policy if exists clinical_update on public.patient_clinical;
create policy clinical_update on public.patient_clinical for update to authenticated
  using ((select public.can_view_clinical())) with check ((select public.can_view_clinical()));

-- visits: front desk, nurses and admins see every field; clinicians only their own
drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits for select to authenticated
  using ((select public.is_staff()) and public.can_see_field(medical_field));
drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits for insert to authenticated
  with check ((select public.is_staff()) and public.can_see_field(medical_field));
drop policy if exists visits_update on public.visits;
create policy visits_update on public.visits for update to authenticated
  using ((select public.is_staff()) and public.can_see_field(medical_field))
  with check ((select public.is_staff()) and public.can_see_field(medical_field));

-- dosage / meal logs: clinical roles, and only for visits they can see. Append-only.
drop policy if exists dosage_select on public.dosage_logs;
create policy dosage_select on public.dosage_logs for select to authenticated
  using ((select public.can_view_clinical()) and exists (select 1 from public.visits v where v.id = visit_id));
drop policy if exists dosage_insert on public.dosage_logs;
create policy dosage_insert on public.dosage_logs for insert to authenticated
  with check ((select public.can_view_clinical()) and logged_by = auth.uid()
              and exists (select 1 from public.visits v where v.id = visit_id));
drop policy if exists meal_select on public.meal_logs;
create policy meal_select on public.meal_logs for select to authenticated
  using ((select public.can_view_clinical()) and exists (select 1 from public.visits v where v.id = visit_id));
drop policy if exists meal_insert on public.meal_logs;
create policy meal_insert on public.meal_logs for insert to authenticated
  with check ((select public.can_view_clinical()) and logged_by = auth.uid()
              and exists (select 1 from public.visits v where v.id = visit_id));

-- audit_log: admins read; staff may only append read-type events (writes are audited by triggers)
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using ((select public.can_manage()));
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert to authenticated
  with check ((select public.is_staff()) and action in ('open-record','search','login','logout'));

-- ---------- Realtime -------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['visits','dosage_logs','meal_logs','settings','patient_clinical'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null; end;
  end loop;
end $$;

-- ---------- Optional: run escalation every minute on the server ------
-- Needs the pg_cron extension (Dashboard > Database > Extensions). If it is not
-- enabled this block is skipped and the dashboard triggers escalation instead.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('beyond-queue-escalate', '* * * * *', 'select public.apply_escalations()');
exception when others then
  raise notice 'pg_cron not enabled - escalation will run from the open dashboard instead.';
end $$;
