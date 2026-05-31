-- ============================================
-- Fulfillment Orders & Machine Requests Tables
-- ============================================
-- Date: 2026-04-12
-- Purpose: Support gym onboarding fulfillment (welcome kits, stickers, stands)
--          and member-driven machine catalog expansion requests.

-- ============================================
-- 1. fulfillment_orders
-- ============================================

CREATE TABLE IF NOT EXISTS public.fulfillment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'welcome_kit',
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'verified')),
  shipping_address JSONB NOT NULL DEFAULT '{}',
  sticker_count INTEGER NOT NULL DEFAULT 0,
  stand_count INTEGER NOT NULL DEFAULT 2,
  carrier VARCHAR(50),
  tracking_number VARCHAR(100),
  tracking_url TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verification_photos TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. machine_requests
-- ============================================

CREATE TABLE IF NOT EXISTS public.machine_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  machine_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  photo_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'sticker_sent')),
  resolved_machine_id UUID REFERENCES public.machines(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. Alter gyms table — add verification columns
-- ============================================

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ============================================
-- 4. Enable RLS
-- ============================================

ALTER TABLE public.fulfillment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS Policies — fulfillment_orders
-- ============================================

-- Gym owners can SELECT their own orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fulfillment_orders_select_own') THEN
    CREATE POLICY fulfillment_orders_select_own ON public.fulfillment_orders
      FOR SELECT USING (
        gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

-- Gym owners can UPDATE their own orders (for verification photos)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fulfillment_orders_update_own') THEN
    CREATE POLICY fulfillment_orders_update_own ON public.fulfillment_orders
      FOR UPDATE USING (
        gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

-- Admins have full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fulfillment_orders_admin_all') THEN
    CREATE POLICY fulfillment_orders_admin_all ON public.fulfillment_orders
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ============================================
-- 6. RLS Policies — machine_requests
-- ============================================

-- Gym owners can SELECT their own requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'machine_requests_select_own') THEN
    CREATE POLICY machine_requests_select_own ON public.machine_requests
      FOR SELECT USING (
        gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

-- Gym owners can INSERT requests for their own gym
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'machine_requests_insert_own') THEN
    CREATE POLICY machine_requests_insert_own ON public.machine_requests
      FOR INSERT WITH CHECK (
        gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

-- Admins have full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'machine_requests_admin_all') THEN
    CREATE POLICY machine_requests_admin_all ON public.machine_requests
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ============================================
-- 7. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_gym_id ON public.fulfillment_orders(gym_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_status ON public.fulfillment_orders(status);
CREATE INDEX IF NOT EXISTS idx_machine_requests_gym_id ON public.machine_requests(gym_id);
CREATE INDEX IF NOT EXISTS idx_machine_requests_status ON public.machine_requests(status);
