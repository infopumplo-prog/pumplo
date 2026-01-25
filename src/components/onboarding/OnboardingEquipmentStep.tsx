import { EQUIPMENT_OPTIONS } from '@/lib/onboardingTypes';

interface OnboardingEquipmentStepProps {
  value: string | null;
  onChange: (equipment: string) => void;
}

const OnboardingEquipmentStep = ({ value, onChange }: OnboardingEquipmentStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Preference vybavení</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Jaký typ cvičení preferuješ?
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {EQUIPMENT_OPTIONS.map((eq) => (
          <button
            key={eq.id}
            onClick={() => onChange(eq.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              value === eq.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className="font-medium">{eq.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingEquipmentStep;
