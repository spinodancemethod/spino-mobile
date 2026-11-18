-- Storage buckets, matching prod's settings.
-- Bucket settings aren't stored in migrations, so they live here.
-- "on conflict do nothing" makes it safe to run more than once.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos',           'videos',           false, null,     array['video/mp4']),
  ('thumbnails',       'thumbnails',       true,  null,     array['image/jpeg','image/jpg','image/png','image/webp']),
  ('roadmap-previews', 'roadmap-previews', true,  null,     array['image/gif','image/webp']),
  ('dance-analysis',   'dance-analysis',   false, null,     null),
  ('analysis-audio',   'analysis-audio',   false, 20971520, array['audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/mpeg']),
  ('category-images',  'category-images',  true,  5242880,  array['image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do nothing;
