

# Plan: Remake WorkoutPreview & WarmupPlayer Components

## Overview

This plan completely rewrites two components from scratch to:
1. **WorkoutPreview** - Fix persistent exercise name overflow with proper layout constraints
2. **WarmupPlayer** - Replace circular timer with horizontal progress bar + click-anywhere to advance

---

## Part 1: WorkoutPreview Remake

### Problem
Exercise names are overflowing and pushing the Dumbbell icon off-screen despite multiple CSS fix attempts. The `ScrollArea` component's viewport doesn't properly constrain child width.

### Solution
Rewrite the exercise list with a bulletproof layout:
- Use a simple `overflow-y-auto` div instead of `ScrollArea`
- Apply strict `box-sizing: border-box` with fixed padding
- Constrain the container width with `calc(100vw - padding)`
- Use explicit max-width on exercise name container

### New Structure
```text
┌──────────────────────────────────────────┐
│ Header: [X] Dnešní trénink   [~58 min]  │
├──────────────────────────────────────────┤
│ Day Info: [A] Horní tělo                 │
│           7 cviků připraveno             │
├──────────────────────────────────────────┤
│ Exercise List (overflow-y-auto):         │
│ ┌──────────────────────────────────────┐ │
│ │ [1] Ez Barbell Anti Grav...   [💪]  │ │
│ │     3 sérií × 10-15 opak.           │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ [2] Kettlebell Single A...    [💪]  │ │
│ │     3 sérií × 10-15 opak.           │ │
│ └──────────────────────────────────────┘ │
│ ... (scrollable)                         │
├──────────────────────────────────────────┤
│ 🔥 Začneme rozcvičkou                    │
│ [ ▶ Začít rozcvičku ]                    │
│                            (pb-28 safe)  │
└──────────────────────────────────────────┘
```

### Key Layout Rules
- Parent container: `w-screen max-w-full overflow-x-hidden`
- Exercise list: `flex-1 overflow-y-auto overflow-x-hidden px-4`
- Each exercise item: `w-full` with flex layout
- Exercise name: `flex-1 min-w-0 overflow-hidden` + child `<p className="truncate">`
- Index and icon: `w-8 shrink-0` and `w-4 shrink-0`

---

## Part 2: WarmupPlayer Remake

### Changes Requested
1. Replace circular timer with horizontal progress bar
2. Click anywhere on screen to advance to next exercise after timer ends
3. Keep similar design aesthetic

### New UI Structure
```text
┌──────────────────────────────────────────┐
│ [🔥 Rozcvička 4/5]      [Přeskočit vše] │
├══════════════════════════════════════════┤ ← Progress bar (exercise progress)
│                                          │
│                                          │
│           [Video / Flame icon]           │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ 18s              │ ← Timer bar (countdown)
├──────────────────────────────────────────┤
│              Circle Elbow Arm            │
│     Drž pozici / Provádej 30 sekund      │
│     [Přední ramena] [Boční ramena]       │
├──────────────────────────────────────────┤
│ [⏸ Pauza]  [⏭ Další cvik]  [→ Trénink] │
└──────────────────────────────────────────┘
```

### Behavior Changes

**Current (automatic):**
- Timer counts down → auto-advance to next exercise

**New (click-to-advance):**
- Timer counts down → when reaches 0, show "Klepni pro další cvik" overlay
- User taps anywhere (except skip/pause buttons) → advance to next exercise
- Last exercise: tap to start workout

### State Machine
```text
┌─────────────┐   timer=0   ┌───────────────┐  tap/click  ┌─────────────┐
│ COUNTING    │ ──────────▶ │ WAITING_TAP   │ ──────────▶ │ NEXT_EXERCISE│
│ timeRemaining│             │ "Klepni..."   │             │ or COMPLETE │
└─────────────┘             └───────────────┘             └─────────────┘
      ▲                                                          │
      │               isPaused=true                              │
      │◀─────────────────────────────────────────────────────────┘
```

### New State Variables
- `isWaitingForTap: boolean` - true when timer finished, waiting for user tap
- Remove auto-advance from timer `useEffect`

---

## Technical Implementation

### Files to Modify

| File | Action |
|------|--------|
| `src/components/workout/WorkoutPreview.tsx` | Complete rewrite |
| `src/components/workout/WarmupPlayer.tsx` | Complete rewrite |

### WorkoutPreview.tsx - New Code Structure

1. Remove `ScrollArea` import, use native scroll
2. Add `overflow-x-hidden` to root container
3. Restructure exercise list item with explicit widths:

```tsx
<div className="flex-1 overflow-y-auto overflow-x-hidden">
  <div className="px-4 py-4 space-y-2">
    {exercises.map((ex, idx) => (
      <div className="flex items-center gap-3 py-3 px-3 rounded-xl bg-muted/50 border border-border/50">
        {/* Index - fixed width */}
        <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="font-bold text-sm text-primary">{idx + 1}</span>
        </div>
        
        {/* Name + details - takes remaining space, truncates */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-medium text-sm truncate">{ex.exerciseName}</p>
          <p className="text-xs text-muted-foreground">
            {ex.sets} sérií × {ex.repMin}-{ex.repMax} opak.
          </p>
        </div>
        
        {/* Icon - fixed width */}
        <Dumbbell className="w-4 h-4 shrink-0 text-muted-foreground" />
      </div>
    ))}
  </div>
</div>
```

### WarmupPlayer.tsx - New Code Structure

1. Replace circular SVG timer with horizontal `Progress` bar
2. Add `isWaitingForTap` state
3. Show tap overlay when waiting
4. Handle tap-anywhere to advance
5. Position timer progress bar above exercise name section

**Timer Progress Bar (replaces circular timer):**
```tsx
{/* Timer progress bar - positioned above exercise info */}
<div className="px-4 py-3 border-t border-border">
  <div className="flex items-center gap-3">
    <Progress 
      value={(timeRemaining / currentExercise.duration) * 100} 
      className={cn("flex-1 h-2", timeRemaining <= 5 && "[&>div]:bg-destructive")}
    />
    <span className={cn(
      "text-lg font-bold tabular-nums w-12 text-right",
      timeRemaining <= 5 && "text-destructive"
    )}>
      {timeRemaining}s
    </span>
  </div>
</div>
```

**Tap-to-advance overlay:**
```tsx
{/* Tap overlay when timer finished */}
{isWaitingForTap && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="absolute inset-0 bg-background/80 flex items-center justify-center z-10"
    onClick={handleAdvance}
  >
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
        <ChevronRight className="w-8 h-8 text-primary" />
      </div>
      <p className="text-lg font-semibold">Klepni pro další cvik</p>
      <p className="text-sm text-muted-foreground">
        {currentIndex < exercises.length - 1 ? exercises[currentIndex + 1].name : 'Spustit trénink'}
      </p>
    </div>
  </motion.div>
)}
```

**Modified timer logic:**
```tsx
useEffect(() => {
  if (isPaused || !currentExercise || isWaitingForTap) return;

  const interval = setInterval(() => {
    setTimeRemaining(prev => {
      if (prev <= 1) {
        clearInterval(interval);
        setIsWaitingForTap(true); // Wait for tap instead of auto-advance
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [currentIndex, exercises, isPaused, currentExercise, isWaitingForTap]);
```

---

## Visual Comparison

### Current WarmupPlayer
- Header with badge + skip all
- Progress bar (exercise progress)
- Video area with overlaid circular timer at bottom
- Exercise info below
- Buttons at bottom

### New WarmupPlayer
- Header with badge + skip all
- Progress bar (exercise progress) - same
- Video area (clean, no timer overlay)
- **NEW: Horizontal timer bar with seconds counter**
- Exercise info below
- Buttons at bottom
- **NEW: Tap overlay when timer ends**

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| WorkoutPreview | ScrollArea with flex layout | Native overflow-y-auto with explicit widths |
| WarmupPlayer Timer | Circular SVG with ring | Horizontal progress bar |
| WarmupPlayer Advance | Auto-advance when timer ends | Click anywhere to advance |
| Exercise name | truncate (not working) | truncate with proper parent constraints |

---

## Files Changed

1. `src/components/workout/WorkoutPreview.tsx` - Complete rewrite
2. `src/components/workout/WarmupPlayer.tsx` - Complete rewrite

