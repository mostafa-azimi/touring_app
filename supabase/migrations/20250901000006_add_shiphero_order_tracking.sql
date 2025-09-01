-- Add ShipHero order tracking fields to store order IDs and links

-- Add fields to tours table for purchase order tracking
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS shiphero_purchase_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shiphero_purchase_order_number TEXT,
  ADD COLUMN IF NOT EXISTS shiphero_purchase_order_url TEXT;

-- Add fields to tour_participants table for sales order tracking
ALTER TABLE public.tour_participants
  ADD COLUMN IF NOT EXISTS shiphero_sales_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shiphero_sales_order_number TEXT,
  ADD COLUMN IF NOT EXISTS shiphero_sales_order_url TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tours_shiphero_po_id ON public.tours(shiphero_purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_tour_participants_shiphero_so_id ON public.tour_participants(shiphero_sales_order_id);

-- Add comments for documentation
COMMENT ON COLUMN public.tours.shiphero_purchase_order_id IS 'ShipHero purchase order ID for tracking';
COMMENT ON COLUMN public.tours.shiphero_purchase_order_number IS 'ShipHero purchase order number for display';
COMMENT ON COLUMN public.tours.shiphero_purchase_order_url IS 'Direct link to purchase order in ShipHero app';
COMMENT ON COLUMN public.tour_participants.shiphero_sales_order_id IS 'ShipHero sales order ID for tracking';
COMMENT ON COLUMN public.tour_participants.shiphero_sales_order_number IS 'ShipHero sales order number for display';
COMMENT ON COLUMN public.tour_participants.shiphero_sales_order_url IS 'Direct link to sales order in ShipHero app';
