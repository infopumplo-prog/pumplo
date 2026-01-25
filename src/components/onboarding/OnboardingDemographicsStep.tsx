import { Input } from '@/components/ui/input';

interface OnboardingDemographicsStepProps {
  gender: string | null;
  age: string;
  height: string;
  weight: string;
  onGenderChange: (gender: string) => void;
  onAgeChange: (age: string) => void;
  onHeightChange: (height: string) => void;
  onWeightChange: (weight: string) => void;
}

const OnboardingDemographicsStep = ({
  gender,
  age,
  height,
  weight,
  onGenderChange,
  onAgeChange,
  onHeightChange,
  onWeightChange,
}: OnboardingDemographicsStepProps) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">O tobě</h2>
      
      {/* Gender Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Pohlaví</label>
        <div className="grid grid-cols-2 gap-4">
          {['Muž', 'Žena'].map((g) => (
            <button
              key={g}
              onClick={() => onGenderChange(g.toLowerCase())}
              className={`p-4 rounded-xl border-2 transition-all ${
                gender === g.toLowerCase()
                  ? 'border-primary bg-primary/10 shadow-primary'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <span className="text-2xl block mb-1">{g === 'Muž' ? '👨' : '👩'}</span>
              <span className="font-medium">{g}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Kolik ti je let?</label>
          <Input
            type="number"
            value={age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder="25"
            className="text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Kolik měříš? (cm)</label>
          <Input
            type="number"
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder="175"
            className="text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Kolik vážíš? (kg)</label>
          <Input
            type="number"
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder="75"
            className="text-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default OnboardingDemographicsStep;
