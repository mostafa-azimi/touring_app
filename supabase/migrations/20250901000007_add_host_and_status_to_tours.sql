-- Add missing host_id and status fields to tours table

-- Add host_id field to link tours to team members
ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Add status field for tour lifecycle management
ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tours_host_id ON public.tours(host_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON public.tours(status);

-- Add comments for documentation
COMMENT ON COLUMN public.tours.host_id IS 'Reference to team member who is hosting the tour';
COMMENT ON COLUMN public.tours.status IS 'Tour status: scheduled, finalized, cancelled';
