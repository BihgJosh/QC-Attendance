alter table public.attendance_records
  drop constraint if exists attendance_records_service_check;

alter table public.attendance_records
  add constraint attendance_records_service_check
  check (
    service in ('Sunday', 'Thursday', 'Other')
    or (
      service like 'Other — %'
      and char_length(btrim(substring(service from char_length('Other — ') + 1))) between 2 and 80
      and service !~ '[[:cntrl:]]'
    )
  );

comment on column public.attendance_records.service is
  'Sunday, Thursday, legacy Other, or a named special event in the form Other — Event Name.';
