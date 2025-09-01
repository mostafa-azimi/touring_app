-- Create swag_items table
CREATE TABLE IF NOT EXISTS public.swag_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.swag_items ENABLE ROW LEVEL SECURITY;

-- Create policies for swag_items (accessible to all authenticated users)
CREATE POLICY "swag_items_select_authenticated" 
  ON public.swag_items FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "swag_items_insert_authenticated" 
  ON public.swag_items FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "swag_items_update_authenticated" 
  ON public.swag_items FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "swag_items_delete_authenticated" 
  ON public.swag_items FOR DELETE 
  USING (auth.uid() IS NOT NULL);
