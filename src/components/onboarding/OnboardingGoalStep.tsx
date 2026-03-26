import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { MVP_GOALS, TrainingGoalId, PLAN_DURATION_WEEKS } from '@/lib/trainingGoals';

interface OnboardingGoalStepProps {
  value: TrainingGoalId | null;
  onChange: (goal: TrainingGoalId) => void;
}

const OnboardingGoalStep = ({ value, onChange }: OnboardingGoalStepProps) => {
  const [expandedGoal, setExpandedGoal] = useState<TrainingGoalId | null>(null);

  const handleGoalTap = (goalId: TrainingGoalId) => {
    setExpandedGoal(expandedGoal === goalId ? null : goalId);
  };

  const handleConfirm = (goalId: TrainingGoalId) => {
    onChange(goalId);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Co je tvůj hlavní cíl?</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Klikni na cíl pro více informací
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Délka plánu: {PLAN_DURATION_WEEKS} týdnů
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {MVP_GOALS.map((goal) => {
          const isExpanded = expandedGoal === goal.id;
          const isSelected = value === goal.id;

          return (
            <div key={goal.id} className="relative">
              <button
                onClick={() => handleGoalTap(goal.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : isExpanded
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <span className="text-2xl">{goal.emoji}</span>
                <div className="flex-1">
                  <span className="font-medium block">{goal.label}</span>
                  <span className="text-sm text-muted-foreground">{goal.description}</span>
                </div>
                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                ) : (
                  <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-2 mt-1 p-4 rounded-xl bg-muted/50 border border-border/50">
                      <p className="text-sm font-medium text-foreground mb-3">
                        {goal.detail.summary}
                      </p>
                      <ul className="space-y-1.5 mb-3">
                        {goal.detail.bullets.map((bullet, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground italic mb-4">
                        {goal.detail.whoIsItFor}
                      </p>
                      <button
                        onClick={() => handleConfirm(goal.id)}
                        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform"
                      >
                        Zvolit tento cíl
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingGoalStep;
