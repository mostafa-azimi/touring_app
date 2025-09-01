-- Temporarily disable RLS for development/testing
-- WARNING: This removes security - only use for development!

-- Disable RLS on all tables
ALTER TABLE public.warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.swag_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_swag_allocations DISABLE ROW LEVEL SECURITY;
