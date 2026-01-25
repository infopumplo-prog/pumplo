import { MVP_GOALS, TrainingGoalId } from '@/lib/trainingGoals';

interface OnboardingGoalStepProps {
  value: TrainingGoalId | null;
  onChange: (goal: TrainingGoalId) => void;
}

const OnboardingGoalStep = ({ value, onChange }: OnboardingGoalStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Co je tvůj hlavní cíl?</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Vyber jeden cíl, podle něj připravíme tvůj tréninkový plán
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {MVP_GOALS.map((goal) => (
          <button
            key={goal.id}
            onClick={() => onChange(goal.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
              value === goal.id
                ? 'border-primary bg-primary/20 shadow-primary'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className="text-2xl">{goal.emoji}</span>
            <div className="flex-1">
              <span className="font-medium block">{goal.label}</span>
              <span className="text-sm text-muted-foreground">{goal.description}</span>
            </div>
            {value === goal.id && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                Vybrán
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingGoalStep;
