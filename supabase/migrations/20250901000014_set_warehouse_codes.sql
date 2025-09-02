-- Set proper airport codes for existing warehouses
UPDATE public.warehouses 
SET code = 'ATL' 
WHERE name = 'Convenience Counter' AND (code IS NULL OR code = '');

-- Set other common airport codes if warehouses exist
UPDATE public.warehouses 
SET code = 'LAX' 
WHERE name ILIKE '%los angeles%' AND (code IS NULL OR code = '');

UPDATE public.warehouses 
SET code = 'JFK' 
WHERE name ILIKE '%new york%' AND (code IS NULL OR code = '');

-- Add a comment
COMMENT ON COLUMN public.warehouses.code IS 'Three-letter airport code for the warehouse location';
