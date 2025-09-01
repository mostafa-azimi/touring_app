-- Create warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Create policies for warehouses (accessible to all authenticated users)
CREATE POLICY "warehouses_select_authenticated" 
  ON public.warehouses FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "warehouses_insert_authenticated" 
  ON public.warehouses FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "warehouses_update_authenticated" 
  ON public.warehouses FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "warehouses_delete_authenticated" 
  ON public.warehouses FOR DELETE 
  USING (auth.uid() IS NOT NULL);
