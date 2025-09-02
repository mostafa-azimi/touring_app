-- Update team_members table to have first_name and last_name instead of name

-- Add first_name and last_name columns
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Update existing records to split name into first_name and last_name
UPDATE public.team_members 
SET 
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Make first_name and last_name NOT NULL after data migration
ALTER TABLE public.team_members 
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

-- Drop the old name column (optional - keeping for backward compatibility)
-- ALTER TABLE public.team_members DROP COLUMN name;

-- Add comments
COMMENT ON COLUMN public.team_members.first_name IS 'Team member first name';
COMMENT ON COLUMN public.team_members.last_name IS 'Team member last name';
