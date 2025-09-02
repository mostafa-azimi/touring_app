-- Clean up test data and remove unused tour_swag_allocations system
-- This migration safely removes all test tour data and unused allocation table

-- Step 1: Clear all test tour data (in correct order to respect foreign keys)
DELETE FROM public.tour_swag_allocations;
DELETE FROM public.tour_participants; 
DELETE FROM public.tours;

-- Step 2: Remove unused tour_swag_allocations table and related objects
-- Drop the view that depends on tour_swag_allocations
DROP VIEW IF EXISTS public.v_tour_swag_totals;

-- Drop the table (this will also drop all policies and indexes)
DROP TABLE IF EXISTS public.tour_swag_allocations;

-- Step 3: Clean up any orphaned indexes that might remain
DROP INDEX IF EXISTS public.uq_alloc;

-- Add comment to document the change
COMMENT ON TABLE public.tours IS 'Tours table - cleaned of test data on 2025-01-02. Swag allocation system removed in favor of manual allocation.';

-- Verify tables that remain (these should all still exist and be populated)
-- warehouses, team_members, swag_items, tours (empty), tour_participants (empty)
