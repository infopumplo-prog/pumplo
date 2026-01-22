import { useState, useCallback } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { TypeSelector } from './steps/TypeSelector';
import { TrainingBranch } from './steps/TrainingBranch';
import { BugBranch } from './steps/BugBranch';
import { FeatureBranch } from './steps/FeatureBranch';
import { ConfusionBranch } from './steps/ConfusionBranch';
import { OtherBranch } from './steps/OtherBranch';
import { ThankYouStep } from './steps/ThankYouStep';
import type { FeedbackData, FeedbackType } from './types';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises?: { id: string; name: string }[];
  workoutContext?: {
    plan_id?: string;
    week_index?: number;
    day_index?: number;
    day_letter?: string;
    gym_id?: string;
  };
}

type Step = 'type' | 'branch' | 'thanks';

export const FeedbackModal = ({ 
  open, 
  onOpenChange, 
  exercises = [],
  workoutContext 
}: FeedbackModalProps) => {
  const [step, setStep] = useState<Step>('type');
  const [data, setData] = useState<Partial<FeedbackData>>({
    ...workoutContext,
  });

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep('type');
      setData({ ...workoutContext });
    }, 300);
  }, [onOpenChange, workoutContext]);

  const handleUpdate = useCallback((updates: Partial<FeedbackData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleTypeNext = useCallback(() => {
    setStep('branch');
  }, []);

  const handleBranchNext = useCallback(() => {
    setStep('thanks');
  }, []);

  const handleBack = useCallback(() => {
    setStep('type');
  }, []);

  const renderBranch = () => {
    const branchProps = {
      data,
      onUpdate: handleUpdate,
      onNext: handleBranchNext,
      onBack: handleBack,
      exercises,
    };

    switch (data.feedback_type as FeedbackType) {
      case 'training_exercises':
        return <TrainingBranch {...branchProps} />;
      case 'bug_error':
        return <BugBranch {...branchProps} />;
      case 'missing_feature':
        return <FeatureBranch {...branchProps} />;
      case 'confusion':
        return <ConfusionBranch {...branchProps} />;
      case 'other':
        return <OtherBranch {...branchProps} />;
      default:
        return null;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Feedback</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8 pt-2 overflow-y-auto">
          {step === 'type' && (
            <TypeSelector 
              data={data} 
              onUpdate={handleUpdate} 
              onNext={handleTypeNext}
            />
          )}
          
          {step === 'branch' && renderBranch()}
          
          {step === 'thanks' && (
            <ThankYouStep data={data} onClose={handleClose} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
