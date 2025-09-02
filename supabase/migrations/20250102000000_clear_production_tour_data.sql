-- Clear all tour-related test data for production deployment
-- This migration removes all tour data while preserving table structure and configuration
-- Safe to run multiple times - only clears data, never drops tables or structure

-- Step 1: Clear tour data in correct order (respecting foreign key constraints)
-- Clear tour_participants first (references tours)
DELETE FROM public.tour_participants;

-- Clear tours last (referenced by tour_participants)
DELETE FROM public.tours;

-- Step 2: Reset any sequences or auto-increment values if they exist
-- (Not applicable for UUID primary keys, but good practice)

-- Step 3: Add comment to document the production data reset
COMMENT ON TABLE public.tours IS 'Tours table - production ready, test data cleared on 2025-01-02';
COMMENT ON TABLE public.tour_participants IS 'Tour participants table - production ready, test data cleared on 2025-01-02';

-- Step 4: Verify the cleanup (these should return 0 rows)
-- SELECT COUNT(*) as tours_count FROM public.tours;
-- SELECT COUNT(*) as participants_count FROM public.tour_participants;

-- Note: The following tables are preserved with their data:
-- - warehouses (your warehouse configuration)
-- - team_members (your team/host data) 
-- - swag_items (your swag inventory)
-- Only tour-specific test data has been cleared.
