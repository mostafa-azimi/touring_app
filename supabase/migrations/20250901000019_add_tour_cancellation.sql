-- Add cancellation tracking to tours table
ALTER TABLE public.tours 
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- Add index for filtering canceled tours
CREATE INDEX IF NOT EXISTS idx_tours_canceled_at ON public.tours(canceled_at);

-- Add comment for documentation
COMMENT ON COLUMN public.tours.canceled_at IS 'Timestamp when tour was canceled (NULL = active tour)';
