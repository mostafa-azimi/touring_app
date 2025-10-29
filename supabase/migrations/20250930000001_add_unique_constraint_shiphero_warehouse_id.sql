-- Add unique constraint on shiphero_warehouse_id for upsert operations
-- This allows us to sync warehouses from ShipHero API without duplicates

-- First, remove any duplicate shiphero_warehouse_ids if they exist
DELETE FROM public.warehouses a
USING public.warehouses b
WHERE a.id < b.id 
  AND a.shiphero_warehouse_id = b.shiphero_warehouse_id
  AND a.shiphero_warehouse_id IS NOT NULL;

-- Add unique constraint on shiphero_warehouse_id
ALTER TABLE public.warehouses 
ADD CONSTRAINT uq_warehouses_shiphero_warehouse_id 
UNIQUE (shiphero_warehouse_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_warehouses_shiphero_warehouse_id 
ON public.warehouses(shiphero_warehouse_id);

