-- Add 6-digit numeric tour ID for internal tracking and order tagging
ALTER TABLE public.tours 
ADD COLUMN IF NOT EXISTS tour_numeric_id INTEGER UNIQUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tours_numeric_id ON public.tours(tour_numeric_id);

-- Add comment to document this field
COMMENT ON COLUMN public.tours.tour_numeric_id IS '6-digit numeric ID for internal tracking and order tagging (not exposed in UI)';
