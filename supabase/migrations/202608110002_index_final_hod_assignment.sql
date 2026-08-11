create index if not exists final_hod_reports_assignment_idx
  on public.final_hod_reports (assignment_id)
  where assignment_id is not null;
