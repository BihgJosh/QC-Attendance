insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uniform-assets',
  'uniform-assets',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploads and deletions are performed only by the service-role Edge Function.
-- No storage.objects policies are intentionally granted to public or authenticated users.
