-- Make warehouse code nullable and add timestamp to avoid duplicates
ALTER TABLE public.warehouses 
ALTER COLUMN code DROP NOT NULL;

-- Add a unique compound index on (code, created_at) instead of just code
-- This allows duplicate codes but with different timestamps
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_code_created_at 
ON public.warehouses(code, created_at) 
WHERE code IS NOT NULL;

