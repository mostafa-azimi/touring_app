-- Run this SQL in the Supabase Dashboard → SQL Editor
-- This will set the proper airport code for Convenience Counter

UPDATE public.warehouses 
SET code = 'ATL' 
WHERE name = 'Convenience Counter';

-- Verify the update
SELECT id, name, code, address, city, state 
FROM public.warehouses 
WHERE name = 'Convenience Counter';
