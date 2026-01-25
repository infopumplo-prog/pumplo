
# Plan: Refactor Onboarding Flow - Pre-Registration with Simplified Questions

## Overview

This plan refactors the onboarding to occur **BEFORE registration** with simplified questions per user request. After registration, the questionnaire data is saved and a workout plan is automatically generated.

## Current State vs. New Requirements

| Aspect | Current | New |
|--------|---------|-----|
| Flow Order | Registration -> Onboarding | Onboarding -> Registration |
| Goals | 6 goals + secondary | 4 goals (single select only) |
| Training Split | User selects manually | Automatic based on goal |
| Gym Selection | In onboarding | NOT in onboarding |
| Bio Data | Missing from early steps | Gender, Height, Weight, Age included |
| Equipment Pref | Stroje / Volné váhy / Intenzivní | Hlavne stroje / Vlastna vaha / Bez preferencie |
| Motivations | Required step | REMOVED |
| Secondary Goals | Allowed | REMOVED |

## New Onboarding Steps (8 Steps + Registration)

```text
Step 1: Goal Selection (single choice)
  - Nabrat svaly (muscle_gain) -> PPL split
  - Zhubnout (fat_loss) -> Upper/Lower split  
  - Ziskat silu (strength) -> Upper/Lower split
  - Celkova kondice (general_fitness) -> Full Body split

Step 2: Training Level
  - Beginner / Intermediate / Advanced

Step 3: Training Days Selection
  - Mon/Tue/Wed/Thu/Fri/Sat/Sun (multi-select)

Step 4: Preferred Time + Duration
  - Morning/Late Morning/Afternoon/Evening
  - Duration slider 30-120 min

Step 5: Demographics (NEW)
  - Gender (Muz/Zena)
  - Height (cm)
  - Weight (kg)
  - Age

Step 6: Injuries
  - Body parts multi-select + "Nemam zadne"

Step 7: Equipment Preference (NEW options)
  - Hlavne stroje
  - Vlastna vaha
  - Bez preferencie

Step 8: Registration
  - First name, Last name, Email, Password
  -> On submit: Save profile + Generate workout plan
```

## Goal to Split Mapping

| Goal | Split Type | Days |
|------|------------|------|
| muscle_gain | PPL (Push/Pull/Legs) | 3 |
| fat_loss | Upper/Lower | 2 |
| strength | Upper/Lower | 2 |
| general_fitness | Full Body | 2 |

## Technical Implementation

### 1. Update `src/lib/trainingGoals.ts`

Add goal-to-split mapping and simplified goal list:

```typescript
// New: 4 MVP goals for onboarding (single select)
export const MVP_GOALS = [
  { 
    id: 'muscle_gain', 
    label: 'Nabrat svaly', 
    emoji: '💪',
    split: 'ppl',
    description: 'Push / Pull / Legs - 3 tréninkové dny',
  },
  { 
    id: 'fat_loss', 
    label: 'Zhubnout', 
    emoji: '🔥',
    split: 'upper_lower',
    description: 'Horní / Dolní tělo - 2 dny',
  },
  { 
    id: 'strength', 
    label: 'Získat sílu', 
    emoji: '🏋️',
    split: 'upper_lower',
    description: 'Horní / Dolní tělo - 2 dny',
  },
  { 
    id: 'general_fitness', 
    label: 'Celková kondice', 
    emoji: '✨',
    split: 'full_body',
    description: 'Full Body - 2 dny',
  },
];

// Mapping goal -> split (for automatic determination)
export const GOAL_TO_SPLIT: Record<TrainingGoalId, string> = {
  'muscle_gain': 'ppl',
  'fat_loss': 'upper_lower',
  'strength': 'upper_lower',
  'general_fitness': 'full_body',
};
```

### 2. Refactor `src/pages/Auth.tsx`

Complete rewrite to handle onboarding-first flow:

**State Management:**
- Add onboarding step state (0-7 for questionnaire, 8 for registration)
- Add all onboarding field states (goal, level, trainingDays, preferredTime, duration, gender, age, height, weight, injuries, equipmentPreference)
- Mode state: 'onboarding' | 'login'

**Flow Logic:**
- When user clicks "Registrace" tab -> start onboarding flow (step 0)
- Navigate through steps 0-6 with Next/Back buttons
- Step 7 = Registration form (name, email, password)
- On registration submit:
  1. Create user via supabase.auth.signUp
  2. Wait for auth state change
  3. Save onboarding data to user_profiles
  4. Generate workout plan automatically
  5. Redirect to home

**UI Structure:**
- Login tab: Standard login form (unchanged)
- Register tab: Multi-step onboarding flow ending with registration

### 3. Simplify `src/components/OnboardingDrawer.tsx`

For edit mode (existing users updating settings):

**Changes:**
- Reduce to 7 steps (remove registration step, it's not needed in edit mode)
- Remove: secondary_goals, motivations
- Update goal selection to single-select only
- Add equipment preference with new options
- Split is auto-determined from goal (read-only display)

**New Equipment Options:**
```typescript
const EQUIPMENT = [
  { id: 'machines', label: 'Hlavně stroje' },
  { id: 'bodyweight', label: 'Vlastní váha' },
  { id: 'no_preference', label: 'Bez preference' },
];
```

### 4. Update `src/contexts/AuthContext.tsx`

Extend register function to accept onboarding data:

```typescript
const register = async (
  email: string, 
  password: string, 
  firstName: string, 
  lastName: string,
  onboardingData?: OnboardingData
): Promise<{ success: boolean; error?: string; userId?: string }>
```

After successful registration, if onboardingData is provided:
1. Update user_profiles with all fields
2. Set onboarding_completed = true
3. Trigger workout plan generation

### 5. Update `src/hooks/useUserProfile.ts`

Ensure the UserProfile interface has all required fields:
- Already has: gender, age, height_cm, weight_kg, injuries, equipment_preference
- Confirm training_split field exists and is being used

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Complete refactor - add 8-step onboarding before registration |
| `src/components/OnboardingDrawer.tsx` | Simplify to 7 steps, remove motivations/secondary goals, update equipment options |
| `src/lib/trainingGoals.ts` | Add MVP_GOALS array, GOAL_TO_SPLIT mapping |
| `src/contexts/AuthContext.tsx` | Extend register to accept and save onboarding data |

## UI/UX Flow Summary

**New User Journey:**
1. User arrives at /auth
2. Sees tabs: "Přihlášení" | "Registrace"
3. Clicks "Registrace" -> Onboarding starts
4. Completes 7 question steps
5. Step 8: Fills registration form (name, email, password)
6. Clicks "Dokončit registraci"
7. System: Creates user -> Saves profile -> Generates plan
8. Redirects to Home with workout ready

**Existing User (Edit Mode):**
1. Opens OnboardingDrawer from Profile
2. Same 7 steps (without registration)
3. Split shown as read-only (derived from goal)
4. Warning: "Změny se projeví až v novém plánu"

## Validation Rules

Each step must be completed before proceeding:
- Step 0 (Goal): One goal must be selected
- Step 1 (Level): One level must be selected  
- Step 2 (Days): At least 1 day selected
- Step 3 (Time): Time selected + duration set
- Step 4 (Demographics): Gender + all bio fields filled
- Step 5 (Injuries): At least one option selected (including "none")
- Step 6 (Equipment): One preference selected
- Step 7 (Registration): All fields filled, valid email, password >= 6 chars
