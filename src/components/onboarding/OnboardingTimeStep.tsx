import { Slider } from '@/components/ui/slider';
import { TIMES, getBeginnerDefaultDuration } from '@/lib/onboardingTypes';
import { UserLevel, TrainingGoalId } from '@/lib/trainingGoals';

interface OnboardingTimeStepProps {
  preferredTime: string | null;
  duration: number;
  onTimeChange: (time: string) => void;
  onDurationChange: (duration: number) => void;
  userLevel?: UserLevel | null;
  goalId?: TrainingGoalId | null;
}

const OnboardingTimeStep = ({
  preferredTime,
  duration,
  onTimeChange,
  onDurationChange,
  userLevel,
  goalId
}: OnboardingTimeStepProps) => {
  const isBeginner = userLevel === 'beginner';
  const beginnerDuration = getBeginnerDefaultDuration(goalId || null);
  const isStrength = goalId === 'strength';
  const minDuration = isStrength ? 60 : 30;

  // Snap up if current duration is below minimum (e.g. user switched to strength with 45 min set)
  if (!isBeginner && duration < minDuration) {
    onDurationChange(minDuration);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">V jaký čas nejraději cvičíš?</h2>
      <div className="grid grid-cols-1 gap-3">
        {TIMES.map((time) => (
          <button
            key={time.id}
            onClick={() => onTimeChange(time.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              preferredTime === time.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{time.emoji}</span>
              <div>
                <span className="font-medium block">{time.label}</span>
                <span className="text-sm text-muted-foreground">{time.time}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {isBeginner ? (
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Délku tréninku nastavíme automaticky na <strong>{beginnerDuration} minut</strong> — ideální pro začátečníky.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-semibold text-center">Kolik minut chceš mít jeden trénink?</h3>
          <div className="px-4">
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-primary">{duration}</span>
              <span className="text-muted-foreground ml-1">min</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={(value) => onDurationChange(value[0])}
              min={minDuration}
              max={120}
              step={5}
              className="w-full"
            />
            <div className="relative w-full mt-2 h-5 text-sm text-muted-foreground">
              <span className="absolute left-0">{minDuration}</span>
              <span className="absolute left-1/3 -translate-x-1/2">60</span>
              <span className="absolute left-2/3 -translate-x-1/2">90</span>
              <span className="absolute right-0">120 min</span>
            </div>
            {isStrength && (
              <p className="text-xs text-amber-500 text-center mt-2">
                Silový trénink potřebuje min. 60 minut — pauzy mezi sériemi jsou 3–5 minut.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingTimeStep;
