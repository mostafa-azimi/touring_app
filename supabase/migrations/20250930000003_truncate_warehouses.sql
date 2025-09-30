-- NUCLEAR CLEAN: Remove ALL existing warehouses to start fresh
-- This will allow ShipHero warehouses to sync without conflicts
TRUNCATE TABLE public.warehouses CASCADE;

