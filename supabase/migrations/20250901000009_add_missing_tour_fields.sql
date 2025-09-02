-- Add missing fields to tours table to match application code

-- Add host_id field (nullable for backward compatibility)
ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Add status field with default
ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tours_host_id ON public.tours(host_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON public.tours(status);

-- Add comments for documentation
COMMENT ON COLUMN public.tours.host_id IS 'Reference to team member who is hosting the tour';
COMMENT ON COLUMN public.tours.status IS 'Tour status: scheduled, finalized, cancelled';
