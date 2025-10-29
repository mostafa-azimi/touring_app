-- Delete old hardcoded warehouses that don't exist in ShipHero
DELETE FROM public.warehouses 
WHERE name IN ('Convenience Counter', 'Touring App Convenience')
   OR code IN ('ATL', 'LAX')
   OR shiphero_warehouse_id = 'V2FyZWhvdXNlOjExOTM0Mw==';

-- Clear any orphaned warehouse references
COMMENT ON TABLE public.warehouses IS 'Warehouses synced from ShipHero API - only current warehouses should exist';
