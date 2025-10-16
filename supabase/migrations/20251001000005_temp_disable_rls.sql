-- TEMPORARY: Disable RLS on critical tables until we update all queries with user context
-- This allows the app to work during the transition period

ALTER TABLE public.warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiphero_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras DISABLE ROW LEVEL SECURITY;

-- NOTE: This is temporary! We need to re-enable RLS after updating all queries
-- to include user_id filtering
