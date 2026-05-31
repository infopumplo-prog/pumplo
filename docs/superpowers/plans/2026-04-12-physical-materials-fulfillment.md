# Physical Materials Fulfillment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a welcome kit fulfillment system — when a gym owner publishes their gym, a fulfillment order is automatically created with stickers + reception stands, tracked through shipping to verification.

**Architecture:** DB tables for orders + machine requests → Stripe checkout adds 500 CZK implementation fee → webhook creates fulfillment order on publish → admin dashboard manages orders → gym owner sees progress + uploads verification photos → badge "Ověřená posilovna" displayed in member app.

**Tech Stack:** Supabase (PostgreSQL + Edge Functions + Storage), Stripe API, React/TypeScript (pumplo-admin), Tailwind + shadcn UI.

**Spec:** `docs/superpowers/specs/2026-04-12-physical-materials-fulfillment-design.md`

---

## Phase 1 — Core Fulfillment (MVP)

### Task 1: Database Migration — fulfillment tables

**Files:**
- Create: `supabase/migrations/20260412_fulfillment_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- fulfillment_orders: tracks welcome kit shipments
CREATE TABLE fulfillment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'welcome_kit',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',

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

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- machine_requests: gym owners request new machine types
CREATE TABLE machine_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,

  machine_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  photo_url TEXT,

  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  resolved_machine_id UUID REFERENCES machines(id),
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add verification flag to gyms
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- RLS policies
ALTER TABLE fulfillment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_requests ENABLE ROW LEVEL SECURITY;

-- Gym owners see own orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fulfillment_orders_select_own') THEN
    CREATE POLICY fulfillment_orders_select_own ON fulfillment_orders
      FOR SELECT USING (
        gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

-- Gym owners can update own orders (for verification photos)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fulfillment_orders_update_own') THEN
    CREATE POLICY fulfillment_orders_update_own ON fulfillment_orders
      FOR UPDATE USING (
        gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

-- Super admins manage all orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fulfillment_orders_admin_all') THEN
    CREATE POLICY fulfillment_orders_admin_all ON fulfillment_orders
      FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      );
  END IF;
END $$;

-- Machine requests: owners see own, admins see all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'machine_requests_select_own') THEN
    CREATE POLICY machine_requests_select_own ON machine_requests
      FOR SELECT USING (
        gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'machine_requests_insert_own') THEN
    CREATE POLICY machine_requests_insert_own ON machine_requests
      FOR INSERT WITH CHECK (
        gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'machine_requests_admin_all') THEN
    CREATE POLICY machine_requests_admin_all ON machine_requests
      FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      );
  END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_gym_id ON fulfillment_orders(gym_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_status ON fulfillment_orders(status);
CREATE INDEX IF NOT EXISTS idx_machine_requests_gym_id ON machine_requests(gym_id);
CREATE INDEX IF NOT EXISTS idx_machine_requests_status ON machine_requests(status);
```

- [ ] **Step 2: Run migration via Supabase CLI**

```bash
npx supabase db query --linked < supabase/migrations/20260412_fulfillment_tables.sql
```

Expected: no errors, tables created.

- [ ] **Step 3: Verify tables exist**

```bash
npx supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('fulfillment_orders','machine_requests');"
```

Expected: 2 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260412_fulfillment_tables.sql
git commit -m "feat(fulfillment): add fulfillment_orders + machine_requests tables"
```

---

### Task 2: Stripe Checkout — add implementation fee

**Files:**
- Modify: `supabase/functions/create-checkout/index.ts`

- [ ] **Step 1: Read current create-checkout function**

Read the full `supabase/functions/create-checkout/index.ts` to understand existing line_items structure.

- [ ] **Step 2: Add implementation fee price ID constant and line item**

Add after existing constants at the top:

```typescript
// Implementation fee — one-time 500 CZK "Aktivace Pumplo kitu"
const IMPLEMENTATION_FEE_PRICE_ID = 'price_1TLJJrEvdp2FxnFOcOEO0cAI';
```

In the `line_items` array of the Stripe checkout session creation, add the fee:

```typescript
line_items: [
  { price: priceId, quantity: 1 },
  // One-time implementation fee (welcome kit: stickers + stands + shipping)
  { price: IMPLEMENTATION_FEE_PRICE_ID, quantity: 1 },
],
```

The `mode` stays `'subscription'` — Stripe supports mixing one-time and recurring items in subscription checkout.

- [ ] **Step 3: Deploy edge function**

```bash
npx supabase functions deploy create-checkout --linked
```

Expected: function deployed successfully.

- [ ] **Step 4: Verify by checking checkout URL**

Open `https://pumplo-admin.vercel.app/register`, go through wizard to checkout step. Stripe Checkout should show two line items: subscription + "Aktivace Pumplo kitu 500 Kč".

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-checkout/index.ts
git commit -m "feat(stripe): add 500 CZK implementation fee to checkout"
```

---

### Task 3: Webhook — create fulfillment order on checkout

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Read current stripe-webhook to understand checkout.session.completed handler**

Read `supabase/functions/stripe-webhook/index.ts` — find the `checkout.session.completed` handler section. It currently creates gym + subscription + user_role + machines.

- [ ] **Step 2: Add fulfillment order creation after gym creation**

After the existing gym creation block in `checkout.session.completed` handler, add:

```typescript
// === Create fulfillment order for welcome kit ===
const machineIds = metadata.machine_ids ? JSON.parse(metadata.machine_ids) : [];

// Count total physical machines (sum of quantities)
let totalStickerCount = machineIds.length; // default: 1 per machine type
try {
  const { data: machineData } = await supabaseAdmin
    .from('gym_machines')
    .select('quantity')
    .eq('gym_id', gymId);
  if (machineData) {
    totalStickerCount = machineData.reduce((sum, m) => sum + (m.quantity || 1), 0);
  }
} catch (e) {
  console.error('Error counting machines for fulfillment:', e);
}

const { error: fulfillmentError } = await supabaseAdmin
  .from('fulfillment_orders')
  .insert({
    gym_id: gymId,
    type: 'welcome_kit',
    status: 'pending',
    shipping_address: {
      address: metadata.address || '',
      phone: metadata.phone || '',
      gym_name: metadata.gym_name || '',
    },
    sticker_count: totalStickerCount,
    stand_count: 2,
    metadata: {
      stripe_session_id: session.id,
      plan_id: planId,
    },
  });

if (fulfillmentError) {
  console.error('Error creating fulfillment order:', fulfillmentError);
} else {
  console.log(`Fulfillment order created for gym ${gymId}: ${totalStickerCount} stickers, 2 stands`);
}
```

- [ ] **Step 3: Deploy webhook**

```bash
npx supabase functions deploy stripe-webhook --linked
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(fulfillment): auto-create fulfillment order on checkout completion"
```

---

### Task 4: Admin Fulfillment Page (pumplo-admin)

**Files:**
- Create: `pumplo-admin/src/pages/FulfillmentOrders.tsx`
- Modify: `pumplo-admin/src/components/layout/Sidebar.tsx` (add nav link)
- Modify: `pumplo-admin/src/App.tsx` (add route)

- [ ] **Step 1: Create FulfillmentOrders page**

Create `pumplo-admin/src/pages/FulfillmentOrders.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Package, Truck, CheckCircle2, Clock, Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface FulfillmentOrder {
  id: string
  gym_id: string
  type: string
  status: string
  shipping_address: {
    address?: string
    phone?: string
    gym_name?: string
  }
  sticker_count: number
  stand_count: number
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: string | null
  delivered_at: string | null
  verified_at: string | null
  verification_photos: string[]
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Čeká na zpracování', color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  processing: { label: 'Zpracovává se', color: 'bg-blue-500/10 text-blue-500', icon: Package },
  shipped: { label: 'Odesláno', color: 'bg-purple-500/10 text-purple-500', icon: Truck },
  delivered: { label: 'Doručeno', color: 'bg-green-500/10 text-green-500', icon: MapPin },
  verified: { label: 'Ověřeno', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle2 },
}

export default function FulfillmentOrders() {
  const { role } = useAuth()
  const [orders, setOrders] = useState<FulfillmentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('fulfillment_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Chyba při načítání objednávek')
      console.error(error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  async function updateStatus(orderId: string, newStatus: string, extraFields: Record<string, unknown> = {}) {
    setUpdatingId(orderId)
    const { error } = await supabase
      .from('fulfillment_orders')
      .update({ status: newStatus, ...extraFields, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      toast.error('Chyba při aktualizaci')
      console.error(error)
    } else {
      toast.success(`Status změněn na: ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      fetchOrders()
    }
    setUpdatingId(null)
  }

  async function markShipped(orderId: string) {
    const tracking = prompt('Zadej tracking number (volitelné):')
    await updateStatus(orderId, 'shipped', {
      shipped_at: new Date().toISOString(),
      tracking_number: tracking || null,
      carrier: 'zasilkovna',
    })
  }

  async function markDelivered(orderId: string) {
    await updateStatus(orderId, 'delivered', {
      delivered_at: new Date().toISOString(),
    })
  }

  if (role !== 'super_admin') {
    return <div className="p-8 text-center text-muted-foreground">Přístup jen pro adminy.</div>
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Package className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Fulfillment objednávky</h1>
        <span className="text-sm text-muted-foreground">({orders.length})</span>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Žádné objednávky.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
            const StatusIcon = statusInfo.icon
            return (
              <div key={order.id} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-base">{order.shipping_address?.gym_name || 'Gym'}</h3>
                    <p className="text-sm text-muted-foreground">{order.shipping_address?.address}</p>
                    {order.shipping_address?.phone && (
                      <p className="text-sm text-muted-foreground">Tel: {order.shipping_address.phone}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusInfo.label}
                  </div>
                </div>

                <div className="flex gap-6 text-sm text-muted-foreground mb-3">
                  <span>{order.sticker_count} samolepek</span>
                  <span>{order.stand_count} stojánků</span>
                  <span>{new Date(order.created_at).toLocaleDateString('cs-CZ')}</span>
                  {order.tracking_number && <span>Tracking: {order.tracking_number}</span>}
                </div>

                {order.verification_photos?.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {order.verification_photos.map((url, i) => (
                      <img key={i} src={url} alt={`Verifikace ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => markShipped(order.id)}
                      disabled={updatingId === order.id}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {updatingId === order.id ? 'Ukládám...' : 'Označit jako odesláno'}
                    </button>
                  )}
                  {order.status === 'shipped' && (
                    <button
                      onClick={() => markDelivered(order.id)}
                      disabled={updatingId === order.id}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {updatingId === order.id ? 'Ukládám...' : 'Označit jako doručeno'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add route to App.tsx**

In `pumplo-admin/src/App.tsx`, add import and route:

```typescript
import FulfillmentOrders from '@/pages/FulfillmentOrders'

// Inside routes:
<Route path="/fulfillment" element={<FulfillmentOrders />} />
```

- [ ] **Step 3: Add sidebar link**

In `pumplo-admin/src/components/layout/Sidebar.tsx`, add after existing nav items (only for super_admin):

```typescript
import { Package } from 'lucide-react'

// In the nav items array, add:
{ to: '/fulfillment', icon: Package, label: 'Fulfillment', adminOnly: true }
```

- [ ] **Step 4: Verify locally**

```bash
cd ~/Desktop/pumplo-admin && npm run dev
```

Navigate to `/fulfillment` — should show empty state "Žádné objednávky."

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/pumplo-admin
git add src/pages/FulfillmentOrders.tsx src/components/layout/Sidebar.tsx src/App.tsx
git commit -m "feat(admin): add fulfillment orders management page"
```

---

### Task 5: Gym Owner — Setup Progress Card

**Files:**
- Create: `pumplo-admin/src/components/SetupProgressCard.tsx`
- Modify: `pumplo-admin/src/pages/Dashboard.tsx` (add card)

- [ ] **Step 1: Create SetupProgressCard component**

Create `pumplo-admin/src/components/SetupProgressCard.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Circle, Package, Truck, Camera, Loader2 } from 'lucide-react'

interface FulfillmentOrder {
  id: string
  status: string
  tracking_number: string | null
  tracking_url: string | null
  sticker_count: number
  verification_photos: string[]
}

interface SetupProgressCardProps {
  gymId: string
}

const STEPS = [
  { key: 'profile', label: 'Profil dokončen', icon: CheckCircle2 },
  { key: 'published', label: 'Gym publikován', icon: CheckCircle2 },
  { key: 'ordered', label: 'Samolepky objednány', icon: Package },
  { key: 'shipped', label: 'Balíček odeslán', icon: Truck },
  { key: 'delivered', label: 'Balíček doručen', icon: Package },
  { key: 'verified', label: 'Samolepky nalepeny', icon: Camera },
]

export default function SetupProgressCard({ gymId }: SetupProgressCardProps) {
  const [order, setOrder] = useState<FulfillmentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!gymId) return
    supabase
      .from('fulfillment_orders')
      .select('*')
      .eq('gym_id', gymId)
      .eq('type', 'welcome_kit')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setOrder(data)
        setLoading(false)
      })
  }, [gymId])

  if (loading) return null
  if (!order) return null

  const completedSteps = new Set<string>()
  completedSteps.add('profile')
  completedSteps.add('published')
  completedSteps.add('ordered')
  if (['shipped', 'delivered', 'verified'].includes(order.status)) completedSteps.add('shipped')
  if (['delivered', 'verified'].includes(order.status)) completedSteps.add('delivered')
  if (order.status === 'verified') completedSteps.add('verified')

  const progress = Math.round((completedSteps.size / STEPS.length) * 100)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !order) return

    setUploading(true)
    const urls: string[] = [...(order.verification_photos || [])]

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) continue
      const ext = file.name.split('.').pop()
      const path = `verification/${order.gym_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('gym-assets')
        .upload(path, file, { upsert: true })

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('gym-assets')
          .getPublicUrl(path)
        urls.push(publicUrl)
      }
    }

    await supabase
      .from('fulfillment_orders')
      .update({
        verification_photos: urls,
        status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    // Set gym as verified
    await supabase
      .from('gyms')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('id', order.gym_id)

    setOrder({ ...order, verification_photos: urls, status: 'verified' })
    setUploading(false)
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Setup posilovny</h3>
        <span className="text-sm text-primary font-bold">{progress}%</span>
      </div>

      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-3">
        {STEPS.map(step => {
          const done = completedSteps.has(step.key)
          const Icon = done ? CheckCircle2 : Circle
          return (
            <div key={step.key} className={`flex items-center gap-3 text-sm ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
              <Icon className={`w-4 h-4 ${done ? 'text-primary' : ''}`} />
              <span>{step.label}</span>
              {step.key === 'shipped' && order.tracking_number && (
                <span className="text-xs text-muted-foreground ml-auto">#{order.tracking_number}</span>
              )}
            </div>
          )
        })}
      </div>

      {order.status === 'delivered' && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Nalepili jste samolepky? Nahrajte 3-5 fotek a získejte badge "Ověřená posilovna".
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {uploading ? 'Nahrávám...' : 'Nahrát fotky'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {order.status === 'verified' && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-emerald-500 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Ověřená posilovna
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add SetupProgressCard to Dashboard**

In `pumplo-admin/src/pages/Dashboard.tsx`, import and render after the stat cards:

```typescript
import SetupProgressCard from '@/components/SetupProgressCard'

// Inside render, after stat cards grid, add:
{gymId && <SetupProgressCard gymId={gymId} />}
```

Note: `gymId` is already available in Dashboard from the existing gym fetch logic.

- [ ] **Step 3: Verify locally**

```bash
cd ~/Desktop/pumplo-admin && npm run dev
```

Dashboard should show setup progress card (if a fulfillment order exists for the user's gym).

- [ ] **Step 4: Commit**

```bash
git add src/components/SetupProgressCard.tsx src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add setup progress card with verification photo upload"
```

---

## Phase 2 — Deployment & Testing

### Task 6: Deploy everything and test end-to-end

**Files:** none (deployment + testing only)

- [ ] **Step 1: Push main pumplo repo**

```bash
cd ~/Desktop/pumplo && git push origin main
```

- [ ] **Step 2: Push pumplo-admin repo**

```bash
cd ~/Desktop/pumplo-admin && git push origin main
```

- [ ] **Step 3: Deploy edge functions**

```bash
cd ~/Desktop/pumplo
npx supabase functions deploy create-checkout --linked
npx supabase functions deploy stripe-webhook --linked
```

- [ ] **Step 4: Verify Stripe checkout shows implementation fee**

Go to `https://pumplo-admin.vercel.app/register`, create a test registration, proceed to checkout. Stripe Checkout should show:
- Subscription line item (e.g. "Pumplo Start — 1 990 Kč/měsíc")
- One-time line item ("Aktivace Pumplo kitu — 500 Kč")

- [ ] **Step 5: Verify fulfillment order created after payment**

After a successful checkout, check Supabase:
```bash
npx supabase db query --linked "SELECT * FROM fulfillment_orders ORDER BY created_at DESC LIMIT 1;"
```

Expected: one row with `status='pending'`, correct `sticker_count`, `shipping_address` with gym info.

- [ ] **Step 6: Verify admin fulfillment page**

Go to `https://pumplo-admin.vercel.app/fulfillment` (logged in as super_admin). Should show the new order with "Čeká na zpracování" status and action buttons.

---

## Phase 3 — Post-Delivery Features (future tasks)

> These are documented but NOT implemented in this plan. Implement as separate follow-up plans when Phase 1+2 are verified.

**Task 7: Balíkobot API integration** — label generation + tracking webhook. Requires Balíkobot account + API contract.

**Task 8: Automated reminders** — Supabase scheduled function (cron) that checks `delivered` orders without `verified` status and sends email reminders at +1, +3, +7 days.

**Task 9: Machine request flow** — form in gym admin dashboard + admin approval page + auto-create fulfillment order for additional stickers.

**Task 10: Badge "Ověřená posilovna" in member app** — display `gyms.is_verified` as badge on MapView pins, GymSelector results, and GymDetailPage.

**Task 11: Welcome letter PDF generation** — server-side PDF with Pumplo wordmark, personalized sticker count, David's signature. Generate on fulfillment order creation.

**Task 12: Placement guide PDF** — static PDF asset with example photos from Eurogym. Include in welcome kit.
