import { UserLevel } from '@/lib/trainingGoals';
import { USER_LEVEL_OPTIONS } from '@/lib/onboardingTypes';

interface OnboardingLevelStepProps {
  value: UserLevel | null;
  onChange: (level: UserLevel) => void;
}

const OnboardingLevelStep = ({ value, onChange }: OnboardingLevelStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Jaká je tvoje tréninková úroveň?</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Pomůže nám nastavit správný objem tréninku
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {USER_LEVEL_OPTIONS.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
              value === level.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className="text-3xl">{level.emoji}</span>
            <div>
              <span className="font-medium block">{level.label}</span>
              <span className="text-sm text-muted-foreground">{level.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingLevelStep;
