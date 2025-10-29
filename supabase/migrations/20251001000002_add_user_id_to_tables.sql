-- Add user_id foreign key to all existing tables for multi-tenancy

-- Add user_id to warehouses table
ALTER TABLE public.warehouses 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Add user_id to team_members (hosts) table
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Add user_id to tours table
ALTER TABLE public.tours 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Add user_id to tenant_config table
ALTER TABLE public.tenant_config 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Add user_id to shiphero_tokens table
ALTER TABLE public.shiphero_tokens 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_warehouses_user_id ON public.warehouses(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tours_user_id ON public.tours(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_user_id ON public.tenant_config(user_id);
CREATE INDEX IF NOT EXISTS idx_shiphero_tokens_user_id ON public.shiphero_tokens(user_id);

-- Add comments
COMMENT ON COLUMN public.warehouses.user_id IS 'Owner of this warehouse - ensures multi-tenant isolation';
COMMENT ON COLUMN public.team_members.user_id IS 'Owner of this host - ensures multi-tenant isolation';
COMMENT ON COLUMN public.tours.user_id IS 'Owner of this tour - ensures multi-tenant isolation';
COMMENT ON COLUMN public.tenant_config.user_id IS 'Owner of this config - ensures multi-tenant isolation';
COMMENT ON COLUMN public.shiphero_tokens.user_id IS 'Owner of these tokens - ensures multi-tenant isolation';
