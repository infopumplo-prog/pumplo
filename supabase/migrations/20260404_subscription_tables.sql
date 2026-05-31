-- ============================================
-- Pumplo SaaS Multi-Tier Subscription Tables
-- ============================================

-- 1. Subscription Plans (config table)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL,
  price_annual INTEGER NOT NULL,
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Gym Subscriptions
CREATE TABLE IF NOT EXISTS public.gym_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  billing_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'annual')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  is_grandfathered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gym_id)
);

-- 3. Subscription Events (audit log)
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('activated', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired', 'payment_failed')),
  from_plan_id TEXT REFERENCES public.subscription_plans(id),
  to_plan_id TEXT REFERENCES public.subscription_plans(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Seed subscription plans
-- ============================================

INSERT INTO public.subscription_plans (id, name, price_monthly, price_annual, sort_order, limits) VALUES
('start', 'Start', 1990, 19900, 1, '{
  "max_machines": 25,
  "max_photos": 3,
  "max_trainers": 1,
  "max_broadcast_messages_monthly": 2,
  "max_active_conversations": 0,
  "analytics_level": "basic",
  "member_detail_level": "basic",
  "featured_listing": false,
  "instagram_display": false,
  "csv_export": false,
  "priority_search": false
}'::jsonb),
('profi', 'Profi', 3990, 39900, 2, '{
  "max_machines": 60,
  "max_photos": 10,
  "max_trainers": 5,
  "max_broadcast_messages_monthly": 10,
  "max_active_conversations": 5,
  "analytics_level": "full",
  "member_detail_level": "full",
  "featured_listing": false,
  "instagram_display": true,
  "csv_export": false,
  "priority_search": false
}'::jsonb),
('premium', 'Premium', 6990, 69900, 3, '{
  "max_machines": -1,
  "max_photos": -1,
  "max_trainers": -1,
  "max_broadcast_messages_monthly": -1,
  "max_active_conversations": -1,
  "analytics_level": "full",
  "member_detail_level": "full",
  "featured_listing": true,
  "instagram_display": true,
  "csv_export": true,
  "priority_search": true
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- subscription_plans: everyone can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscription_plans_select_all') THEN
    CREATE POLICY subscription_plans_select_all ON public.subscription_plans
      FOR SELECT USING (true);
  END IF;
END $$;

-- gym_subscriptions: business users see their own gym, admins see all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_subscriptions_select_own') THEN
    CREATE POLICY gym_subscriptions_select_own ON public.gym_subscriptions
      FOR SELECT USING (
        gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_subscriptions_admin_all') THEN
    CREATE POLICY gym_subscriptions_admin_all ON public.gym_subscriptions
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- subscription_events: admins only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscription_events_admin_only') THEN
    CREATE POLICY subscription_events_admin_only ON public.subscription_events
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ============================================
-- Limit checking function (generic)
-- ============================================

CREATE OR REPLACE FUNCTION public.check_gym_limit(p_gym_id UUID, p_limit_key TEXT, p_current_count INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  max_allowed INTEGER;
BEGIN
  SELECT (sp.limits->>p_limit_key)::INTEGER INTO max_allowed
  FROM public.gym_subscriptions gs
  JOIN public.subscription_plans sp ON sp.id = gs.plan_id
  WHERE gs.gym_id = p_gym_id AND gs.status = 'active';

  -- No subscription found or grandfathered = no limit
  IF max_allowed IS NULL THEN RETURN true; END IF;
  -- -1 means unlimited
  IF max_allowed = -1 THEN RETURN true; END IF;

  RETURN p_current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_gym_subscriptions_gym_id ON public.gym_subscriptions(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_subscriptions_status ON public.gym_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_gym_id ON public.subscription_events(gym_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON public.subscription_events(created_at);
