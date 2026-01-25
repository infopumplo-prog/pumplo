

# Plan: Fix Exercise Name Ellipsis & Training Days Data Sync

## Overview

This plan addresses **2 issues**:

1. **Exercise name overflow in WorkoutPreview** - Long exercise names should truncate with ellipsis instead of causing the container/icons to overflow past view width
2. **Training days data inconsistency** - Home page "Nadcházející tréninky" updates immediately when onboarding changes, but should use the same snapshotted data as /training

---

## Issue 1: Exercise Name Ellipsis in WorkoutPreview

### Root Cause
Looking at the uploaded screenshot, the exercise list items in `WorkoutPreview.tsx` have the Dumbbell icons cut off on the right side. While the code has `truncate` on the exercise name, the parent container's width isn't being constrained properly within the `ScrollArea`.

### Solution
Add width constraint to the exercise list container and ensure the parent scroll area doesn't allow horizontal overflow.

### File to Modify
- `src/components/workout/WorkoutPreview.tsx`

### Changes

Update line 64 to add `w-full` to the container:
```typescript
// Current (line 64):
<div className="px-4 py-4 space-y-2 overflow-hidden">

// New:
<div className="px-4 py-4 space-y-2 overflow-hidden w-full">
```

Additionally, ensure the `ScrollArea` has proper width constraints by adding `w-full` (line 63):
```typescript
// Current:
<ScrollArea className="flex-1">

// New:
<ScrollArea className="flex-1 w-full">
```

Also verify exercise name text has proper truncation with a max-width on the text container (line 76-77):
```typescript
// Current:
<div className="flex-1 min-w-0">
  <p className="font-medium text-sm truncate">{ex.exerciseName}</p>

// This is already correct - flex-1 + min-w-0 allows truncate to work
```

---

## Issue 2: Training Days Data Inconsistency

### Root Cause
In `src/pages/Home.tsx` line 57:
```typescript
const trainingDays = profile?.training_days || [];
```

This reads directly from the user's profile, which updates immediately when onboarding settings change. In contrast, the Training page (`src/pages/Training.tsx` lines 142-152) correctly uses the snapshotted `plan.trainingDays` when a plan exists.

### Solution
Update `Home.tsx` to use the same logic as `Training.tsx` - prioritize `plan.trainingDays` when an active plan exists, and only fall back to profile when there's no plan.

### File to Modify
- `src/pages/Home.tsx`

### Changes

Replace lines 56-57:
```typescript
// Current:
// Training days from profile
const trainingDays = profile?.training_days || [];
```

With the same logic used in Training.tsx:
```typescript
// Training days - use snapshotted plan data when plan exists
const trainingDays = plan?.trainingDays || profile?.training_days || [];
```

This ensures:
- When user has an active plan → uses the snapshotted `trainingDays` from plan creation time
- When user has no plan → falls back to profile (for pre-plan state)

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `src/components/workout/WorkoutPreview.tsx` | 63-64 | Add `w-full` class to ScrollArea and container |
| `src/pages/Home.tsx` | 56-57 | Use `plan?.trainingDays` first, fall back to profile |

---

## Technical Details

### WorkoutPreview Width Fix
The flex layout with `flex-1 min-w-0 truncate` on the exercise name is correct, but the parent `ScrollArea` component may not be constraining its width properly. Adding `w-full` ensures the container respects the parent's width boundaries.

### Data Flow for Training Days
```text
┌─────────────────────┐     ┌──────────────────────┐
│  Profile Change     │     │  Plan Generation     │
│  (user_profiles)    │     │  (user_workout_plans)│
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          │ ❌ Current (wrong)         │ ✅ Correct
          ▼                            ▼
    Home.tsx reads              Training.tsx reads
    profile.training_days       plan.trainingDays
          │                            │
          ▼                            ▼
    Updates immediately         Stable until plan
    when user changes           is regenerated
    onboarding
```

After the fix, both pages will read from `plan.trainingDays` first:
```text
┌───────────────────────────────────────────────────┐
│                   Active Plan                      │
│                (plan.trainingDays)                 │
└──────────────────────┬────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   Home.tsx                      Training.tsx
   (Nadcházející tréninky)       (Day schedule)
```

