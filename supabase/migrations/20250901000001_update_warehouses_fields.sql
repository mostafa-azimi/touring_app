-- Update warehouses table with normalized address fields and additional required fields
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS code TEXT, -- 3 digit airport code
  ADD COLUMN IF NOT EXISTS address2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS shiphero_warehouse_id TEXT;

-- Create unique index for the 3-digit airport code
CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_code ON public.warehouses(code);

-- Update the existing address field to be optional since we're breaking it down
ALTER TABLE public.warehouses ALTER COLUMN address DROP NOT NULL;
