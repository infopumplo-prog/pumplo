# QR Station System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable gym members to scan QR codes on equipment and view exercise videos with a CTA to download the Pumplo app.

**Architecture:** Public lazy-loaded route `/s/:code` in the existing React app. Each `gym_machine` record gets a unique `short_code` via DB trigger. The station page fetches exercises for that machine and displays a fullscreen video player with app download banner.

**Tech Stack:** React, Supabase (DB + Storage), qr-code-styling (QR generation), jspdf (PDF export), react-router-dom (public route)

---

## File Structure

### New files
- `src/pages/StationPage.tsx` — public station page (video player + banner + CTA)
- `src/components/station/StationBanner.tsx` — top "Open in app" banner
- `src/components/station/StationCTA.tsx` — bottom call-to-action
- `src/components/station/StationVideoPlayer.tsx` — simplified video player for public page
- `src/hooks/useStationData.ts` — fetch gym_machine + exercises by short_code
- `src/pages/business/GymQRCodes.tsx` — business dashboard QR management page
- `src/components/business/QRCodeCard.tsx` — individual QR code preview + download
- `src/lib/qrGenerator.ts` — QR code generation with Pumplo branding
- `supabase/migrations/XXXXXX_add_short_code_to_gym_machines.sql` — DB migration

### Modified files
- `src/App.tsx` — add public `/s/:code` route
- `src/integrations/supabase/types.ts` — add `short_code` to gym_machines type
- `src/pages/business/BusinessLayout.tsx` — add QR codes nav link

---

## Task 1: Database Migration — short_code field + trigger

**Files:**
- Create: `supabase/migrations/20260408_add_short_code.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add short_code column
ALTER TABLE gym_machines
ADD COLUMN short_code VARCHAR(8) UNIQUE;

-- Function to generate unique 8-char code
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM gym_machines WHERE short_code = code);
  END LOOP;
  NEW.short_code := code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate on insert
CREATE TRIGGER trg_gym_machine_short_code
BEFORE INSERT ON gym_machines
FOR EACH ROW
WHEN (NEW.short_code IS NULL)
EXECUTE FUNCTION generate_short_code();

-- Backfill existing records
DO $$
DECLARE
  r RECORD;
  chars TEXT := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INTEGER;
BEGIN
  FOR r IN SELECT id FROM gym_machines WHERE short_code IS NULL LOOP
    LOOP
      code := '';
      FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM gym_machines WHERE short_code = code);
    END LOOP;
    UPDATE gym_machines SET short_code = code WHERE id = r.id;
  END LOOP;
END $$;

-- Make short_code NOT NULL after backfill
ALTER TABLE gym_machines ALTER COLUMN short_code SET NOT NULL;

-- RLS: allow public read via short_code
CREATE POLICY "Public read gym_machines by short_code"
ON gym_machines FOR SELECT
USING (short_code IS NOT NULL);
```

- [ ] **Step 2: Run migration against Supabase**

```bash
SUPABASE_ACCESS_TOKEN=sbp_7f2cb1aef1c2d04cfc3f1ff941d00906f12d5855 \
npx supabase db query --linked < supabase/migrations/20260408_add_short_code.sql
```

Expected: no errors, all gym_machines now have short_codes.

- [ ] **Step 3: Verify backfill**

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db query --linked \
"SELECT id, machine_id, short_code FROM gym_machines LIMIT 5;"
```

Expected: all rows have 8-character short_code values.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260408_add_short_code.sql
git commit -m "feat: add short_code to gym_machines for QR station links"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Add short_code to gym_machines Row type**

Find the `gym_machines` Row interface in `src/integrations/supabase/types.ts` and add:

```typescript
short_code: string
```

to the Row, Insert (as optional `short_code?: string`), and Update (as optional `short_code?: string`) types.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add short_code type to gym_machines"
```

---

## Task 3: Station Data Hook

**Files:**
- Create: `src/hooks/useStationData.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StationExercise {
  id: string;
  name: string;
  video_path: string | null;
  description: string | null;
  setup_instructions: string | null;
  common_mistakes: string | null;
  tips: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: number | null;
  category: string | null;
  equipment_type: string | null;
}

interface StationData {
  machineName: string;
  machineDescription: string | null;
  gymName: string;
  gymId: string;
  exercises: StationExercise[];
}

export const useStationData = (shortCode: string | undefined) => {
  const [data, setData] = useState<StationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      // 1. Get gym_machine by short_code
      const { data: gymMachine, error: gmError } = await supabase
        .from('gym_machines')
        .select('machine_id, gym_id, machines(name, description)')
        .eq('short_code', shortCode)
        .single();

      if (gmError || !gymMachine) {
        setError('Cvičiště nenalezeno');
        setIsLoading(false);
        return;
      }

      // 2. Get gym name
      const { data: gym } = await supabase
        .from('gyms')
        .select('name')
        .eq('id', gymMachine.gym_id)
        .single();

      // 3. Get exercises for this machine
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name, video_path, description, setup_instructions, common_mistakes, tips, primary_muscles, secondary_muscles, difficulty, category, equipment_type')
        .eq('machine_id', gymMachine.machine_id)
        .eq('allowed_phase', 'main');

      const machine = gymMachine.machines as any;

      setData({
        machineName: machine?.name || 'Cvičiště',
        machineDescription: machine?.description || null,
        gymName: gym?.name || '',
        gymId: gymMachine.gym_id,
        exercises: exercises || [],
      });
      setIsLoading(false);
    };

    fetchData();
  }, [shortCode]);

  return { data, isLoading, error };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStationData.ts
git commit -m "feat: add useStationData hook for QR station page"
```

---

## Task 4: Station Banner Component

**Files:**
- Create: `src/components/station/StationBanner.tsx`

- [ ] **Step 1: Create the banner**

```typescript
import { X } from 'lucide-react';
import { useState } from 'react';

interface StationBannerProps {
  gymName: string;
}

export const StationBanner = ({ gymName }: StationBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const getStoreLink = () => {
    const ua = navigator.userAgent;
    // Pre-launch: just go to auth
    // Post-launch: replace with actual store URLs
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return '/auth'; // TODO: replace with App Store URL after launch
    }
    if (/Android/i.test(ua)) {
      return '/auth'; // TODO: replace with Google Play URL after launch
    }
    return '/auth';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2.5"
      style={{ background: '#0B1222', borderBottom: '1px solid rgba(76, 201, 255, 0.2)' }}>
      <div className="flex items-center gap-3">
        <img src="/pumplo-icon.png" alt="Pumplo" className="w-8 h-8 rounded-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div>
          <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Pumplo</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{gymName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a href={getStoreLink()}
          className="px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: '#4CC9FF', color: '#fff', fontSize: '13px' }}>
          Otevřít
        </a>
        <button type="button" onClick={() => setDismissed(true)}
          className="p-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/station/StationBanner.tsx
git commit -m "feat: add StationBanner component for app download prompt"
```

---

## Task 5: Station CTA Component

**Files:**
- Create: `src/components/station/StationCTA.tsx`

- [ ] **Step 1: Create the CTA**

```typescript
import { Dumbbell } from 'lucide-react';

export const StationCTA = () => {
  const getStoreLink = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return '/auth';
    if (/Android/i.test(ua)) return '/auth';
    return '/auth';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3"
      style={{ background: 'linear-gradient(to top, #0B1222 60%, transparent)' }}>
      <a href={getStoreLink()}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5"
        style={{ background: '#4CC9FF', color: '#fff', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>
        <Dumbbell className="w-5 h-5" />
        Vytvoř si tréninkový plán zdarma
      </a>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/station/StationCTA.tsx
git commit -m "feat: add StationCTA component for app download"
```

---

## Task 6: Station Video Player

**Files:**
- Create: `src/components/station/StationVideoPlayer.tsx`

- [ ] **Step 1: Create simplified video player for public page**

```typescript
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Exercise {
  id: string;
  name: string;
  video_path: string | null;
  description: string | null;
  setup_instructions: string | null;
  common_mistakes: string | null;
  tips: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: number | null;
}

interface StationVideoPlayerProps {
  exercises: Exercise[];
  machineName: string;
}

const extractVideoFilePath = (videoPath: string): string => {
  const bucketMarker = '/exercise-videos/';
  const idx = videoPath.indexOf(bucketMarker);
  if (idx !== -1) return videoPath.substring(idx + bucketMarker.length);
  return videoPath;
};

export const StationVideoPlayer = ({ exercises, machineName }: StationVideoPlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const exercise = exercises[currentIndex];

  useEffect(() => {
    if (!exercise?.video_path) {
      setVideoUrl(null);
      return;
    }
    const filePath = extractVideoFilePath(exercise.video_path);
    supabase.storage
      .from('exercise-videos')
      .createSignedUrl(filePath, 3600)
      .then(({ data }) => setVideoUrl(data?.signedUrl || null));
  }, [exercise?.video_path]);

  if (!exercise) return null;

  const goNext = () => setCurrentIndex((i) => (i + 1) % exercises.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + exercises.length) % exercises.length);

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: '#000' }}>
      {/* Video */}
      <div className="flex-1 relative flex items-center justify-center">
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full"
            style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
            Video není k dispozici
          </div>
        )}

        {/* Nav arrows */}
        {exercises.length > 1 && (
          <>
            <button type="button" onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button type="button" onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Info button */}
        <button type="button" onClick={() => setShowInfo(true)}
          className="absolute top-4 right-4 p-2 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Exercise name + dots */}
      <div className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.8)' }}>
        <p style={{ color: '#fff', fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>
          {exercise.name}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textAlign: 'center', marginTop: '2px' }}>
          {machineName}
        </p>
        {exercises.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {exercises.map((_, i) => (
              <div key={i} className="rounded-full"
                style={{
                  width: i === currentIndex ? '20px' : '6px',
                  height: '6px',
                  background: i === currentIndex ? '#4CC9FF' : 'rgba(255,255,255,0.3)',
                  borderRadius: '3px',
                  transition: 'all 0.2s',
                }} />
            ))}
          </div>
        )}
      </div>

      {/* Info overlay */}
      {showInfo && (
        <div className="absolute inset-0 z-20 overflow-y-auto"
          style={{ background: 'rgba(11, 18, 34, 0.95)' }}>
          <div className="px-5 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>{exercise.name}</h2>
              <button type="button" onClick={() => setShowInfo(false)}
                className="p-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {exercise.difficulty && (
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="rounded-full"
                    style={{
                      width: '8px', height: '8px',
                      background: i < exercise.difficulty! ? '#4CC9FF' : 'rgba(255,255,255,0.2)',
                    }} />
                ))}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginLeft: '6px' }}>
                  Obtížnost
                </span>
              </div>
            )}
            {exercise.primary_muscles?.length > 0 && (
              <div className="mb-4">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>Hlavní svaly</p>
                <div className="flex flex-wrap gap-1.5">
                  {exercise.primary_muscles.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(76, 201, 255, 0.15)', color: '#4CC9FF', fontSize: '12px' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {exercise.secondary_muscles?.length > 0 && (
              <div className="mb-4">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>Vedlejší svaly</p>
                <div className="flex flex-wrap gap-1.5">
                  {exercise.secondary_muscles.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {exercise.description && (
              <div className="mb-4">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>Popis</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' }}>{exercise.description}</p>
              </div>
            )}
            {exercise.setup_instructions && (
              <div className="mb-4">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>Nastavení</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' }}>{exercise.setup_instructions}</p>
              </div>
            )}
            {exercise.common_mistakes && (
              <div className="mb-4">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>Časté chyby</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' }}>{exercise.common_mistakes}</p>
              </div>
            )}
            {exercise.tips && (
              <div className="mb-4">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>Tipy</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' }}>{exercise.tips}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/station/StationVideoPlayer.tsx
git commit -m "feat: add StationVideoPlayer for public QR station page"
```

---

## Task 7: Station Page

**Files:**
- Create: `src/pages/StationPage.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { useParams } from 'react-router-dom';
import { useStationData } from '@/hooks/useStationData';
import { StationBanner } from '@/components/station/StationBanner';
import { StationCTA } from '@/components/station/StationCTA';
import { StationVideoPlayer } from '@/components/station/StationVideoPlayer';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

const StationPage = () => {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error } = useStationData(code);

  // Set page title dynamically
  useEffect(() => {
    if (data) {
      document.title = `${data.machineName} — cviky | ${data.gymName} | Pumplo`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0B1222' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#4CC9FF' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#0B1222' }}>
        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Cvičiště nenalezeno
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
          QR kód je neplatný nebo byl odstraněn.
        </p>
      </div>
    );
  }

  if (data.exercises.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#0B1222' }}>
        <StationBanner gymName={data.gymName} />
        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px', marginTop: '60px' }}>
          {data.machineName}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>
          Pro toto cvičiště zatím nemáme videa.
        </p>
        <StationCTA />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
      <StationBanner gymName={data.gymName} />
      <div className="flex-1 mt-12 mb-16">
        <StationVideoPlayer exercises={data.exercises} machineName={data.machineName} />
      </div>
      <StationCTA />
    </div>
  );
};

export default StationPage;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/StationPage.tsx
git commit -m "feat: add StationPage for public QR station view"
```

---

## Task 8: Add Public Route to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add lazy import at top of file**

Add near other imports at top of `src/App.tsx`:

```typescript
const StationPage = lazy(() => import('./pages/StationPage'));
```

- [ ] **Step 2: Add public route before ProtectedRoute**

In the `<Routes>` block, add the station route alongside other public routes (like `/auth` and `/install`):

```typescript
<Route path="/s/:code" element={
  <Suspense fallback={
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0B1222' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#4CC9FF' }} />
    </div>
  }>
    <StationPage />
  </Suspense>
} />
```

Add `Loader2` to lucide-react imports if not already there. Add `Suspense` to React imports if not already there.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add public /s/:code route for QR station pages"
```

---

## Task 9: QR Code Generator Utility

**Files:**
- Create: `src/lib/qrGenerator.ts`

- [ ] **Step 1: Install qr-code-styling**

```bash
npm install qr-code-styling
```

- [ ] **Step 2: Create the generator**

```typescript
import QRCodeStyling from 'qr-code-styling';

const PUMPLO_LOGO_URL = '/pumplo-icon.png';

export const generateStationQR = (shortCode: string, size = 1000): QRCodeStyling => {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/s/${shortCode}`;

  return new QRCodeStyling({
    width: size,
    height: size,
    type: 'svg',
    data: url,
    image: PUMPLO_LOGO_URL,
    dotsOptions: {
      color: '#ffffff',
      type: 'rounded',
    },
    backgroundOptions: {
      color: '#0B1222',
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 10,
      imageSize: 0.35,
    },
    cornersSquareOptions: {
      color: '#4CC9FF',
      type: 'extra-rounded',
    },
    cornersDotOptions: {
      color: '#4CC9FF',
      type: 'dot',
    },
    qrOptions: {
      errorCorrectionLevel: 'H',
    },
  });
};

export const downloadQRAsPNG = async (shortCode: string, machineName: string): Promise<void> => {
  const qr = generateStationQR(shortCode, 2000);
  const blob = await qr.getRawData('png');
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pumplo-qr-${machineName.toLowerCase().replace(/\s+/g, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/qrGenerator.ts package.json package-lock.json
git commit -m "feat: add QR code generator with Pumplo branding"
```

---

## Task 10: QR Code Card Component

**Files:**
- Create: `src/components/business/QRCodeCard.tsx`

- [ ] **Step 1: Create the card**

```typescript
import { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { generateStationQR, downloadQRAsPNG } from '@/lib/qrGenerator';

interface QRCodeCardProps {
  shortCode: string;
  machineName: string;
  quantity: number;
}

export const QRCodeCard = ({ shortCode, machineName, quantity }: QRCodeCardProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrRef.current) return;
    qrRef.current.innerHTML = '';
    const qr = generateStationQR(shortCode, 200);
    qr.append(qrRef.current);
  }, [shortCode]);

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-start gap-4">
        <div ref={qrRef} className="shrink-0 rounded-lg overflow-hidden" style={{ width: '100px', height: '100px' }} />
        <div className="flex-1 min-w-0">
          <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{machineName}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}>
            {quantity}x samolepek
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px', fontFamily: 'monospace' }}>
            {shortCode}
          </p>
        </div>
        <button type="button" onClick={() => downloadQRAsPNG(shortCode, machineName)}
          className="shrink-0 p-2 rounded-lg"
          style={{ background: 'rgba(76, 201, 255, 0.1)', color: '#4CC9FF' }}>
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/business/QRCodeCard.tsx
git commit -m "feat: add QRCodeCard component for business dashboard"
```

---

## Task 11: Business QR Codes Page

**Files:**
- Create: `src/pages/business/GymQRCodes.tsx`
- Modify: `src/App.tsx` — add route

- [ ] **Step 1: Create the page**

```typescript
import { useGym } from '@/contexts/GymContext';
import { useGymMachines } from '@/hooks/useGymMachines';
import { QRCodeCard } from '@/components/business/QRCodeCard';
import { QrCode, Loader2 } from 'lucide-react';

const GymQRCodes = () => {
  const { selectedGym } = useGym();
  const { machines, isLoading } = useGymMachines(selectedGym?.id || null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#4CC9FF' }} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <QrCode className="w-6 h-6" style={{ color: '#4CC9FF' }} />
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>QR kódy</h1>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px' }}>
        QR kódy pro vaše cvičiště. Stáhněte a vytiskněte na samolepky.
      </p>

      {machines.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          Zatím nemáte přidané žádné stroje.
        </p>
      ) : (
        <div className="space-y-3">
          {machines.map((m: any) => (
            <QRCodeCard
              key={m.id}
              shortCode={m.short_code}
              machineName={m.machines?.name || 'Stroj'}
              quantity={m.quantity || 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GymQRCodes;
```

- [ ] **Step 2: Add route to App.tsx**

In the business routes section of `src/App.tsx`, add:

```typescript
<Route path="qr-codes" element={<GymQRCodes />} />
```

Import at top:
```typescript
const GymQRCodes = lazy(() => import('./pages/business/GymQRCodes'));
```

- [ ] **Step 3: Add nav link to BusinessLayout**

In `src/pages/business/BusinessLayout.tsx`, add QR codes link to navigation alongside existing items:

```typescript
{ icon: QrCode, label: 'QR kódy', path: '/business/qr-codes' }
```

Add `QrCode` to lucide-react imports.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/business/GymQRCodes.tsx src/App.tsx src/pages/business/BusinessLayout.tsx
git commit -m "feat: add QR codes management page to business dashboard"
```

---

## Task 12: Update useGymMachines to include short_code

**Files:**
- Modify: `src/hooks/useGymMachines.ts`

- [ ] **Step 1: Add short_code to the select query**

In `useGymMachines.ts`, find the `.select()` query and add `short_code` to it. The select should include:

```typescript
.select('id, gym_id, machine_id, quantity, max_weight_kg, bench_configs, short_code, machines(id, name, description, image_url, requires_bench_config)')
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGymMachines.ts
git commit -m "feat: include short_code in gym machines query"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Verify a short_code exists in DB**

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db query --linked \
"SELECT gm.short_code, m.name FROM gym_machines gm JOIN machines m ON m.id = gm.machine_id WHERE gm.gym_id = '39684b2f-9e5a-484b-bf84-d30eae18691c' LIMIT 5;"
```

- [ ] **Step 2: Start dev server and test public route**

```bash
npm run dev
```

Navigate to `http://localhost:5173/s/{short_code_from_step_1}` in browser.

Expected: Station page loads with exercise videos for that machine, banner at top, CTA at bottom.

- [ ] **Step 3: Test error state**

Navigate to `http://localhost:5173/s/invalid123`

Expected: "Cvičiště nenalezeno" error page.

- [ ] **Step 4: Test business QR page**

Log in as gym owner, navigate to `/business/qr-codes`.

Expected: List of all gym machines with QR code previews and download buttons.

- [ ] **Step 5: Push to deploy**

```bash
git push
```

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "feat: QR station system complete — public pages + business QR management"
```
