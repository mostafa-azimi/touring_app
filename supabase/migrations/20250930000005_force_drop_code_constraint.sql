-- FORCE DROP the unique constraint on code that's blocking warehouse inserts
-- This constraint is causing 409 errors when syncing ShipHero warehouses

-- Drop the constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_warehouses_code'
    ) THEN
        ALTER TABLE public.warehouses DROP CONSTRAINT uq_warehouses_code;
        RAISE NOTICE 'Dropped constraint uq_warehouses_code';
    ELSE
        RAISE NOTICE 'Constraint uq_warehouses_code does not exist';
    END IF;
END $$;

-- Verify it's gone
SELECT conname FROM pg_constraint WHERE conrelid = 'public.warehouses'::regclass;

