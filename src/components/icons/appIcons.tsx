// Jednotné ikony Pumplo místo emoji (David 8. 10. 2026): emoji vypadají na iOS a Androidu
// jinak a nejdou obarvit barvou appky. Tady jsou SVG ikony (Lucide + pár vlastních) ve stejném
// stylu (tah 2 px, zaoblené konce), které přebírají barvu z `currentColor` → i z barvy appky.

import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  BicepsFlexed, Bus, Car, ClipboardList, CloudSun, Crown, Dog, Dumbbell, Flame, Heart, HeartPulse,
  Moon, Piano, Plane, Refrigerator, Repeat, Smile, Sparkles, Sprout, Sun, Sunrise, Tractor, TrendingUp,
  Trophy, Truck, Video, Wrench, Users,
} from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// --- Vlastní ikony (Lucide 0.462 nemá symboly pohlaví) ------------------------------------
const svgProps = (size: LucideProps['size'], strokeWidth: LucideProps['strokeWidth']) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: size ?? 24,
  height: size ?? 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: strokeWidth ?? 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const MaleIcon = forwardRef<SVGSVGElement, LucideProps>(({ size, strokeWidth, className, ...rest }, ref) => (
  <svg ref={ref} {...svgProps(size, strokeWidth)} className={className} aria-hidden="true" {...rest}>
    <circle cx="10" cy="14" r="6" />
    <path d="M14.5 9.5 20 4" />
    <path d="M15 4h5v5" />
  </svg>
)) as unknown as LucideIcon;
(MaleIcon as { displayName?: string }).displayName = 'MaleIcon';

export const FemaleIcon = forwardRef<SVGSVGElement, LucideProps>(({ size, strokeWidth, className, ...rest }, ref) => (
  <svg ref={ref} {...svgProps(size, strokeWidth)} className={className} aria-hidden="true" {...rest}>
    <circle cx="12" cy="9" r="6" />
    <path d="M12 15v7" />
    <path d="M9 19h6" />
  </svg>
)) as unknown as LucideIcon;
(FemaleIcon as { displayName?: string }).displayName = 'FemaleIcon';

// --- Registry ----------------------------------------------------------------------------
export const GOAL_ICONS: Record<string, LucideIcon> = {
  muscle_gain: BicepsFlexed,
  fat_loss: Flame,
  strength: Dumbbell,
  general_fitness: HeartPulse,
};

export const LEVEL_ICONS: Record<string, LucideIcon> = {
  beginner: Sprout,
  intermediate: TrendingUp,
  advanced: Trophy,
};

export const TIME_ICONS: Record<string, LucideIcon> = {
  morning: Sunrise,
  late_morning: Sun,
  afternoon: CloudSun,
  evening: Moon,
};

export const GENDER_ICONS: Record<string, LucideIcon> = {
  muž: MaleIcon,
  žena: FemaleIcon,
};

export const MOTIVATION_ICONS: Record<string, LucideIcon> = {
  feel_better: Smile,
  look_better: Sparkles,
  health: Heart,
  strength: BicepsFlexed,
  confidence: Crown,
  sport: Trophy,
};

export const EXPECTATION_ICONS: Record<string, LucideIcon> = {
  custom_plan: ClipboardList,
  guidance: Video,
  progress: TrendingUp,
  consistency: Repeat,
  build_own: Wrench,
  community: Users,
};

/** Sdílecí karta „Zvedl jsi celkem…“ — srovnání s věcmi, pro které existuje ikona. */
export const FUNFACT_ICONS: Record<string, LucideIcon> = {
  plane: Plane,
  bus: Bus,
  truck: Truck,
  tractor: Tractor,
  car: Car,
  piano: Piano,
  fridge: Refrigerator,
  dog: Dog,
};

// --- Odznak s ikonou (místo velkého emoji na kartách dotazníku) ----------------------------
interface IconBadgeProps {
  icon: LucideIcon;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BADGE_SIZE = { sm: 'w-9 h-9 rounded-xl', md: 'w-11 h-11 rounded-xl', lg: 'w-14 h-14 rounded-2xl' } as const;
const ICON_SIZE = { sm: 18, md: 22, lg: 28 } as const;

export const IconBadge = ({ icon: Icon, active = false, size = 'md', className }: IconBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center shrink-0 transition-colors',
      BADGE_SIZE[size],
      active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
      className,
    )}
  >
    <Icon size={ICON_SIZE[size]} strokeWidth={2.2} aria-hidden="true" />
  </span>
);
