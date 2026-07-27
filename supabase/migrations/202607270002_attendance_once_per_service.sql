drop index if exists public.attendance_records_one_approved_device_per_day;

create unique index if not exists attendance_records_one_approved_device_per_service
  on public.attendance_records (attendance_date_key, service, device_id)
  where status = 'Approved' and device_id <> '' and admin_override = false;
