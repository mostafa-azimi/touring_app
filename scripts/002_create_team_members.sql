-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members (accessible to all authenticated users)
CREATE POLICY "team_members_select_authenticated" 
  ON public.team_members FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "team_members_insert_authenticated" 
  ON public.team_members FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "team_members_update_authenticated" 
  ON public.team_members FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "team_members_delete_authenticated" 
  ON public.team_members FOR DELETE 
  USING (auth.uid() IS NOT NULL);
