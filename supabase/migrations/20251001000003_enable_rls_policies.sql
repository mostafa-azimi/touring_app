-- Enable Row Level Security (RLS) and create policies for multi-tenant data isolation

-- Enable RLS on all tables
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiphero_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

-- Warehouses policies
CREATE POLICY "Users can view own warehouses" ON public.warehouses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own warehouses" ON public.warehouses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own warehouses" ON public.warehouses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own warehouses" ON public.warehouses
  FOR DELETE USING (auth.uid() = user_id);

-- Team members (hosts) policies
CREATE POLICY "Users can view own hosts" ON public.team_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hosts" ON public.team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hosts" ON public.team_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hosts" ON public.team_members
  FOR DELETE USING (auth.uid() = user_id);

-- Tours policies
CREATE POLICY "Users can view own tours" ON public.tours
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tours" ON public.tours
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tours" ON public.tours
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tours" ON public.tours
  FOR DELETE USING (auth.uid() = user_id);

-- Tour participants policies (through tour ownership)
CREATE POLICY "Users can view participants of own tours" ON public.tour_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tours 
      WHERE tours.id = tour_participants.tour_id 
      AND tours.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert participants to own tours" ON public.tour_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tours 
      WHERE tours.id = tour_participants.tour_id 
      AND tours.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update participants of own tours" ON public.tour_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tours 
      WHERE tours.id = tour_participants.tour_id 
      AND tours.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete participants of own tours" ON public.tour_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tours 
      WHERE tours.id = tour_participants.tour_id 
      AND tours.user_id = auth.uid()
    )
  );

-- Tenant config policies
CREATE POLICY "Users can view own tenant config" ON public.tenant_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tenant config" ON public.tenant_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tenant config" ON public.tenant_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tenant config" ON public.tenant_config
  FOR DELETE USING (auth.uid() = user_id);

-- ShipHero tokens policies
CREATE POLICY "Users can view own tokens" ON public.shiphero_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON public.shiphero_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.shiphero_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.shiphero_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Extras policies (shared demo data - all users can read, only admins can modify)
CREATE POLICY "All users can view extras" ON public.extras
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert extras" ON public.extras
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update extras" ON public.extras
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete extras" ON public.extras
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );
