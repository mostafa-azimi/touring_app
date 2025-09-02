-- Create tours table
CREATE TABLE IF NOT EXISTS public.tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  host_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

-- Create policies for tours (accessible to all authenticated users)
CREATE POLICY "tours_select_authenticated" 
  ON public.tours FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tours_insert_authenticated" 
  ON public.tours FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tours_update_authenticated" 
  ON public.tours FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tours_delete_authenticated" 
  ON public.tours FOR DELETE 
  USING (auth.uid() IS NOT NULL);
