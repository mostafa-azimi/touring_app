-- Rename team_members table to hosts and update structure
-- Add new columns for first_name and last_name
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing name data to first_name (split on first space)
UPDATE public.team_members 
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

-- Make first_name required after migration
ALTER TABLE public.team_members ALTER COLUMN first_name SET NOT NULL;

-- Drop the old name column after migration
-- ALTER TABLE public.team_members DROP COLUMN IF EXISTS name;

-- Rename the table to hosts
-- ALTER TABLE public.team_members RENAME TO hosts;

-- Note: Table rename and column drop are commented out for safety
-- Uncomment these lines after verifying the migration works correctly
