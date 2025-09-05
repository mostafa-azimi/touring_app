-- Add order_summary field to tours table to store comprehensive order details for tour summary

ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS order_summary JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.tours.order_summary IS 'JSON object containing comprehensive order details including sales orders and purchase orders with ShipHero IDs and legacy IDs for tour summary display';

-- Add index for better query performance on order_summary
CREATE INDEX IF NOT EXISTS idx_tours_order_summary ON public.tours USING GIN(order_summary);
