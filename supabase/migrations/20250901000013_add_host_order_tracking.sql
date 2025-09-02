-- Add host order tracking fields to tours table
ALTER TABLE public.tours 
ADD COLUMN IF NOT EXISTS host_shiphero_sales_order_id TEXT,
ADD COLUMN IF NOT EXISTS host_shiphero_sales_order_number TEXT,
ADD COLUMN IF NOT EXISTS host_shiphero_sales_order_url TEXT;

-- Add comment to document these fields
COMMENT ON COLUMN public.tours.host_shiphero_sales_order_id IS 'ShipHero order ID for the host sales order';
COMMENT ON COLUMN public.tours.host_shiphero_sales_order_number IS 'ShipHero order number for the host sales order';
COMMENT ON COLUMN public.tours.host_shiphero_sales_order_url IS 'ShipHero dashboard URL for the host sales order';
