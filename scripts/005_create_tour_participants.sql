-- Create tour_participants table
CREATE TABLE IF NOT EXISTS public.tour_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tour_participants ENABLE ROW LEVEL SECURITY;

-- Create policies for tour_participants (accessible to all authenticated users)
CREATE POLICY "tour_participants_select_authenticated" 
  ON public.tour_participants FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tour_participants_insert_authenticated" 
  ON public.tour_participants FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tour_participants_update_authenticated" 
  ON public.tour_participants FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tour_participants_delete_authenticated" 
  ON public.tour_participants FOR DELETE 
  USING (auth.uid() IS NOT NULL);
