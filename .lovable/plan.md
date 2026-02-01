
# Zobrazení detailu splněného tréninku na domovské stránce

## Problém

Po kliknutí na splněný trénink (zelená karta) na domovské stránce se uživatel přesměruje na `/profile/history` - obecnou historii. Místo toho chce vidět **detail konkrétního tréninku** - seznam cviků, opakování, váhy a další údaje jako na konci workoutu.

## Řešení

Přidáme **Drawer/Dialog** přímo na domovskou stránku, který se otevře po kliknutí na splněný trénink a zobrazí detail tohoto tréninku pomocí existující komponenty `WorkoutSessionCard`.

## Změny

### 1. Získat ID splněného tréninku

Aktuálně `stats.lastDays` obsahuje pouze agregované statistiky, ale potřebujeme session ID. Upravíme logiku pro získání dnešního tréninku přímo z databáze.

### 2. Přidat stav pro zobrazení detailu

```tsx
const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
const [showSessionDetail, setShowSessionDetail] = useState(false);
```

### 3. Načíst dnešní trénink s detaily

Přidáme query pro získání dnešního tréninku:

```tsx
const [todayWorkoutSession, setTodayWorkoutSession] = useState<WorkoutSession | null>(null);

useEffect(() => {
  const fetchTodaySession = async () => {
    if (!user || !wasCompletedToday) return;
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', startOfDay.toISOString())
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data) setTodayWorkoutSession(data);
  };
  
  fetchTodaySession();
}, [user, wasCompletedToday]);
```

### 4. Přidat Drawer s detailem tréninku

Použijeme existující `Drawer` komponentu:

```tsx
<Drawer open={showSessionDetail} onOpenChange={setShowSessionDetail}>
  <DrawerContent className="max-h-[85vh]">
    <DrawerHeader>
      <DrawerTitle className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-green-500" />
        Dnešní trénink dokončen
      </DrawerTitle>
    </DrawerHeader>
    <div className="px-4 pb-6 overflow-y-auto">
      {todayWorkoutSession && (
        <WorkoutSessionCard 
          session={todayWorkoutSession} 
          variant="full" 
        />
      )}
    </div>
  </DrawerContent>
</Drawer>
```

### 5. Upravit onClick na splněném tréninku

Místo navigace na `/profile/history` otevřeme drawer:

```tsx
onClick={isClickable ? () => setShowSessionDetail(true) : undefined}
```

## Vizuální náhled

```text
┌─────────────────────────────────────────┐
│  [Drawer - Detail tréninku]             │
│  ─────────────────────────────────────  │
│  🏆 Dnešní trénink dokončen             │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  Den A   Středa 1. února            ││
│  │  35 min • 18 sérií                  ││
│  ├─────────────────────────────────────┤│
│  │  ⏱️ 35    💪 18    ⚖️ 1250   🔥 175  ││
│  │  min     sérií    kg       kcal    ││
│  ├─────────────────────────────────────┤│
│  │  Cviky:                             ││
│  │  ┌─────────────────────────────────┐││
│  │  │ Bench Press                     │││
│  │  │ 4 sérií • 32 opakování          │││
│  │  │ [60kg×8] [70kg×6] [80kg×4]...   │││
│  │  └─────────────────────────────────┘││
│  │  ┌─────────────────────────────────┐││
│  │  │ Incline Dumbbell Press          │││
│  │  │ 3 sérií • 24 opakování          │││
│  │  │ [20kg×8] [22kg×8] [22kg×8]      │││
│  │  └─────────────────────────────────┘││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/Home.tsx` | Přidat stav, query pro dnešní session, Drawer s WorkoutSessionCard |

## Nové importy

```tsx
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { WorkoutSessionCard } from '@/components/workout/WorkoutSessionCard';
import { Trophy } from 'lucide-react';
```

## Očekávaný výsledek

1. Uživatel klikne na zelenou kartu splněného tréninku na domovské stránce
2. Otevře se drawer s detailem tréninku
3. Uvidí statistiky (čas, série, váha, kalorie)
4. Uvidí seznam všech cviků s jednotlivými sériemi a vahami
5. Může drawer zavřít a zůstat na domovské stránce
