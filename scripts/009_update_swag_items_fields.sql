-- Update swag_items table with SKU and vendor_id fields
ALTER TABLE public.swag_items
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS vendor_id TEXT;

-- Create unique index for SKU to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_swag_items_sku ON public.swag_items(sku);
