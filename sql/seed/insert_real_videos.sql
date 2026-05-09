-- Insert real video rows.
--
-- Before running:
--   1. Get position UUIDs:
--        SELECT id, name FROM public.positions ORDER BY "order";
--
--   2. Get your admin user UUID:
--        SELECT id FROM auth.users WHERE email = 'info@spinodancemethod.com';
--
--   3. Upload each .mp4 to the 'videos' Storage bucket (e.g. bachata/lesson-1.mp4)
--      and note the file_path (the path within the bucket, not the full URL).
--
--   4. Upload thumbnails to the 'thumbnails' bucket and roadmap GIFs to the
--      'roadmap-previews' bucket, then note the public URLs.
--
-- Replace every <PLACEHOLDER> below with real values before running.

BEGIN;

INSERT INTO public.videos
  (title, description, url, file_path,
   thumbnail_url, roadmap_preview_url, roadmap_gif_url,
   dance_type, dance_style, is_position, position_id, user_id, level, access_tier)
VALUES

  -- ── Example row — duplicate and fill in for each video ───────────────────
  (
    'Lesson 1 - Basic Step',
    'Learn the bachata basic step on 1.',
    NULL,                              -- url: NULL when video lives in Storage
    'bachata/lesson-1.mp4',            -- file_path: path inside the 'videos' bucket
    'https://<project-ref>.supabase.co/storage/v1/object/public/thumbnails/bachata/lesson-1.jpg',
    'https://<project-ref>.supabase.co/storage/v1/object/public/roadmap-previews/bachata/lesson-1.gif',
    NULL,                              -- roadmap_gif_url: NULL if same as roadmap_preview_url
    'bachata',                         -- dance_type: 'bachata' | 'salsa'
    'fusion',                          -- dance_style
    false,                             -- is_position: true only for position-overview videos
    '<POSITION_ID>',                   -- position_id: UUID from positions table
    '<ADMIN_USER_ID>',                 -- user_id: admin UUID from auth.users
    1,                                 -- level: 1–5
    'free'                             -- access_tier: 'free' | 'paid'
  )

  -- Add more rows here, separated by commas:
  -- ,
  -- (
  --   'Lesson 2 - Side Step',
  --   'Bachata side step technique.',
  --   NULL,
  --   'bachata/lesson-2.mp4',
  --   'https://<project-ref>.supabase.co/storage/v1/object/public/thumbnails/bachata/lesson-2.jpg',
  --   'https://<project-ref>.supabase.co/storage/v1/object/public/roadmap-previews/bachata/lesson-2.gif',
  --   NULL,
  --   'bachata',
  --   'fusion',
  --   false,
  --   '<POSITION_ID>',
  --   '<ADMIN_USER_ID>',
  --   1,
  --   'paid'
  -- )

  ;

COMMIT;
