-- Drop the unique constraint on code to allow duplicate codes from ShipHero
ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS uq_warehouses_code;

-- We only need unique constraint on shiphero_warehouse_id
-- The code constraint was causing 409 errors

