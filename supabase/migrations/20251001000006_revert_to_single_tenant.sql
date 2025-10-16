-- Revert multi-tenant changes - remove user_id columns
-- This app uses single-tenant-per-deployment model (one Supabase DB per customer)

-- Drop all RLS policies first
DROP POLICY IF EXISTS "Users can view own warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Users can insert own warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Users can update own warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Users can delete own warehouses" ON public.warehouses;

DROP POLICY IF EXISTS "Users can view own hosts" ON public.team_members;
DROP POLICY IF EXISTS "Users can insert own hosts" ON public.team_members;
DROP POLICY IF EXISTS "Users can update own hosts" ON public.team_members;
DROP POLICY IF EXISTS "Users can delete own hosts" ON public.team_members;

DROP POLICY IF EXISTS "Users can view own tours" ON public.tours;
DROP POLICY IF EXISTS "Users can insert own tours" ON public.tours;
DROP POLICY IF EXISTS "Users can update own tours" ON public.tours;
DROP POLICY IF EXISTS "Users can delete own tours" ON public.tours;

DROP POLICY IF EXISTS "Users can view participants of own tours" ON public.tour_participants;
DROP POLICY IF EXISTS "Users can insert participants to own tours" ON public.tour_participants;
DROP POLICY IF EXISTS "Users can update participants of own tours" ON public.tour_participants;
DROP POLICY IF EXISTS "Users can delete participants of own tours" ON public.tour_participants;

DROP POLICY IF EXISTS "Users can view own tenant config" ON public.tenant_config;
DROP POLICY IF EXISTS "Users can insert own tenant config" ON public.tenant_config;
DROP POLICY IF EXISTS "Users can update own tenant config" ON public.tenant_config;
DROP POLICY IF EXISTS "Users can delete own tenant config" ON public.tenant_config;

DROP POLICY IF EXISTS "Users can view own tokens" ON public.shiphero_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.shiphero_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON public.shiphero_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON public.shiphero_tokens;

DROP POLICY IF EXISTS "All users can view extras" ON public.extras;
DROP POLICY IF EXISTS "Admins can insert extras" ON public.extras;
DROP POLICY IF EXISTS "Admins can update extras" ON public.extras;
DROP POLICY IF EXISTS "Admins can delete extras" ON public.extras;

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Now remove user_id columns
ALTER TABLE public.warehouses DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.tours DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.tenant_config DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.shiphero_tokens DROP COLUMN IF EXISTS user_id;

-- Drop the users table (not needed for single-tenant)
DROP TABLE IF EXISTS public.users CASCADE;

-- RLS is already disabled, keep it that way
-- Each customer gets their own database, so no need for row-level isolation
