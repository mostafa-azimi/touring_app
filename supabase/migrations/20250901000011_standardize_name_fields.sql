-- Standardize all name fields to use first_name, last_name consistently

-- Update tour_participants table to use first_name, last_name instead of name
ALTER TABLE public.tour_participants 
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing data from name to first_name, last_name
UPDATE public.tour_participants 
SET 
  first_name = CASE 
    WHEN position(' ' in name) > 0 THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL;

-- Make first_name required after data migration
ALTER TABLE public.tour_participants 
  ALTER COLUMN first_name SET NOT NULL;
