insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-profile-photo-staging',
  'member-profile-photo-staging',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 15728640,
    allowed_mime_types = excluded.allowed_mime_types;
