-- Create tour_swag_allocations table
CREATE TABLE IF NOT EXISTS public.tour_swag_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.tour_participants(id) ON DELETE CASCADE,
  swag_item_id UUID NOT NULL REFERENCES public.swag_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_id, participant_id, swag_item_id)
);

-- Enable RLS
ALTER TABLE public.tour_swag_allocations ENABLE ROW LEVEL SECURITY;

-- Create policies for tour_swag_allocations (accessible to all authenticated users)
CREATE POLICY "tour_swag_allocations_select_authenticated" 
  ON public.tour_swag_allocations FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tour_swag_allocations_insert_authenticated" 
  ON public.tour_swag_allocations FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tour_swag_allocations_update_authenticated" 
  ON public.tour_swag_allocations FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tour_swag_allocations_delete_authenticated" 
  ON public.tour_swag_allocations FOR DELETE 
  USING (auth.uid() IS NOT NULL);
