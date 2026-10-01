-- =====================================================================
-- OPTIONAL demo data. Run in the SQL Editor AFTER schema.sql.
-- Safe to run more than once (skips patients that already exist).
-- Delete these rows before going live: they are fictional.
-- =====================================================================
do $$
declare pid uuid; vid uuid; r record;
begin
  -- helper: add_demo(id_number, name, age, gender, history, medicine, category, field, reason,
  --                  minutes_ago, priority, confirmed, status)
  create temporary table if not exists _demo (
    id_number text, name text, age int, gender public.gender_type, bt text, hx text, med text,
    cat public.visit_category, fld public.medical_field, reason text, mins int,
    prio public.priority_level, confirmed boolean, st public.patient_status, override text, ward text
  ) on commit drop;
  truncate _demo;
  insert into _demo values
   ('9001015800087','Thandiwe Nkosi',36,'female','O+','Hypertension diagnosed 2019. No surgeries.','Amlodipine 5mg daily','chronic-care','internal-medicine','Dizziness and elevated blood pressure',25,'high',true,'waiting',null,null),
   ('9203155800083','Thabo Mokoena',34,'male','A+','None recorded','None','general','general-practice','Persistent cough for two weeks',10,'low',false,'awaiting-triage',null,null),
   ('9507120123084','Lerato Dlamini',30,'female','B+','G2P1, previous caesarean','Folic acid','maternity','obstetrics','Reduced foetal movement at 34 weeks',50,'high',true,'waiting',null,null),
   ('8811255012085','Sipho Khumalo',37,'male','AB-','Type 2 diabetes','Metformin 850mg','emergency','emergency','Chest pain radiating to left arm',20,'critical',true,'with-clinician',null,null),
   ('1801015012086','Ayanda Zulu',7,'female','O+','Asthma','Salbutamol inhaler','paediatrics','paediatrics','Wheezing after school sports',35,'standard',true,'waiting','Mild symptoms, responding to inhaler',null),
   ('7005055012088','Vusi Khumalo',56,'male','A-','Previous MI 2021','Aspirin, atorvastatin','chronic-care','internal-medicine','Heart failure exacerbation',300,'high',true,'admitted',null,'Medical Ward B, Bed 12'),
   ('6502025012089','Nomvula Sithole',61,'female','O-','Osteoarthritis','Ibuprofen','follow-up','general-practice','Follow-up: knee pain review',120,'standard',true,'waiting',null,null);

  for r in select * from _demo loop
      if exists (select 1 from public.patients where id_number = r.id_number) then continue; end if;
      insert into public.patients (id_number, name, address, contact, email, next_of_kin, next_of_kin_contact, age, gender, popia_consent)
      values (r.id_number, r.name, 'Johannesburg, Gauteng', '082 000 0000', '', 'Next of kin', '083 000 0000', r.age, r.gender, true)
      returning id into pid;
      insert into public.patient_clinical (patient_id, blood_type, medical_history, previous_medicine, current_medical_status)
      values (pid, r.bt, r.hx, r.med, '');
      insert into public.visits (patient_id, reason_for_visit, visit_category, medical_field, priority,
                                 triage_confirmed, triage_override_reason, status, arrived_at, first_contact_at,
                                 ward, admission_reason, admitted_at)
      values (pid, r.reason, r.cat, r.fld, r.prio, r.confirmed, r.override, r.st,
              now() - make_interval(mins => r.mins),
              case when r.st in ('with-clinician','admitted') then now() - make_interval(mins => r.mins - 12) end,
              r.ward, case when r.st = 'admitted' then r.reason end,
              case when r.st = 'admitted' then now() - make_interval(mins => r.mins - 30) end)
      returning id into vid;
      if r.st = 'admitted' then
        insert into public.dosage_logs (visit_id, medicine, dose, given_by, given_at)
          values (vid, 'Furosemide', '40mg IV', 'Sr. Mabena', now() - interval '3 hours'),
                 (vid, 'Aspirin', '75mg oral', 'Sr. Mabena', now() - interval '90 minutes');
        insert into public.meal_logs (visit_id, meal, notes, received_at)
          values (vid, 'breakfast', 'Ate 50%', now() - interval '4 hours');
      end if;
  end loop;
end $$;
