import React from 'react';
import { useTranslation } from 'react-i18next';
import { translateMuscle } from '@/lib/muscleTranslation';

interface ExerciseInfoContentProps {
  category?: string;
  equipmentType?: string | null;
  machineName?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  primaryMusclesEn?: string[] | null;
  secondaryMusclesEn?: string[] | null;
  description?: string | null;
  descriptionEn?: string | null;
  setupInstructions?: string | null;
  setupInstructionsEn?: string | null;
  commonMistakes?: string | null;
  commonMistakesEn?: string | null;
  tips?: string | null;
  tipsEn?: string | null;
  children?: React.ReactNode;
}

const getCategoryLabel = (key: string, t: (k: string) => string) =>
  t('category.' + key, { defaultValue: key });

const getEquipmentLabel = (key: string, t: (k: string) => string) =>
  t('equipment.' + key, { defaultValue: key });

export function ExerciseInfoContent({
  category,
  equipmentType,
  machineName,
  primaryMuscles = [],
  secondaryMuscles = [],
  primaryMusclesEn,
  secondaryMusclesEn,
  description,
  descriptionEn,
  setupInstructions,
  setupInstructionsEn,
  commonMistakes,
  commonMistakesEn,
  tips,
  tipsEn,
  children,
}: ExerciseInfoContentProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const desc = isEn && descriptionEn ? descriptionEn : description;
  const setup = isEn && setupInstructionsEn ? setupInstructionsEn : setupInstructions;
  const mistakes = isEn && commonMistakesEn ? commonMistakesEn : commonMistakes;
  const tipsText = isEn && tipsEn ? tipsEn : tips;

  const primaryMusclesDisplay = isEn && primaryMusclesEn?.length ? primaryMusclesEn : null;
  const secondaryMusclesDisplay = isEn && secondaryMusclesEn?.length ? secondaryMusclesEn : null;

  return (
    <div>
      {(category || equipmentType || machineName) && (
        <p className="text-sm text-muted-foreground mb-4">
          {category && getCategoryLabel(category, t)}
          {equipmentType && ` · ${getEquipmentLabel(equipmentType, t)}`}
          {machineName && ` · ${machineName}`}
        </p>
      )}

      {children}

      {((primaryMusclesDisplay ?? primaryMuscles)?.length ?? 0) > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('workout.primary_muscles')}</p>
          <div className="flex flex-wrap gap-1.5">
            {(primaryMusclesDisplay ?? primaryMuscles).map((m) => (
              <span key={m} className="text-xs bg-[#5BC8F5]/15 text-[#5BC8F5] px-2.5 py-1 rounded-full font-medium">
                {primaryMusclesDisplay ? m : translateMuscle(m, isEn)}
              </span>
            ))}
          </div>
        </div>
      )}

      {((secondaryMusclesDisplay ?? secondaryMuscles)?.length ?? 0) > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('workout.secondary_muscles')}</p>
          <div className="flex flex-wrap gap-1.5">
            {(secondaryMusclesDisplay ?? secondaryMuscles).map((m) => (
              <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                {secondaryMusclesDisplay ? m : translateMuscle(m, isEn)}
              </span>
            ))}
          </div>
        </div>
      )}

      {desc && (
        <div className="mb-3 p-3 bg-muted/50 rounded-xl">
          <p className="text-xs font-semibold text-foreground mb-1">{t('workout.description_technique')}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{desc}</p>
        </div>
      )}

      {setup && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-foreground mb-1">{t('workout.setup')}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{setup}</p>
        </div>
      )}

      {mistakes && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-amber-600 mb-1">{t('workout.common_mistakes')}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{mistakes}</p>
        </div>
      )}

      {tipsText && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-green-600 mb-1">{t('workout.tips')}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tipsText}</p>
        </div>
      )}
    </div>
  );
}
