import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AppFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppFeedbackDialog = ({ open, onOpenChange }: AppFeedbackDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [satisfaction, setSatisfaction] = useState('');
  const [improvements, setImprovements] = useState('');
  const [favoriteFeature, setFavoriteFeature] = useState('');
  const [issues, setIssues] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('app_feedback').insert({
      user_id: user.id,
      experience_rating: rating || null,
      satisfaction,
      improvements,
      favorite_feature: favoriteFeature,
      issues,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(t('feedback.submit_error'));
    } else {
      setSubmitted(true);
      setTimeout(() => {
        onOpenChange(false);
        setSubmitted(false);
        // Reset form
        setRating(0);
        setSatisfaction('');
        setImprovements('');
        setFavoriteFeature('');
        setIssues('');
      }, 2000);
    }
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-chart-2 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t('feedback.thanks_title')}</h2>
            <p className="text-muted-foreground">{t('feedback.thanks_desc')}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('feedback.dialog_title')}</DialogTitle>
          <DialogDescription>
            {t('feedback.dialog_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star rating */}
          <div>
            <Label>{t('feedback.rating_label')}</Label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      star <= rating
                        ? 'fill-chart-4 text-chart-4'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Open questions */}
          <div>
            <Label htmlFor="satisfaction">{t('feedback.satisfaction_label')}</Label>
            <Textarea
              id="satisfaction"
              value={satisfaction}
              onChange={(e) => setSatisfaction(e.target.value)}
              placeholder={t('feedback.satisfaction_placeholder')}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="improvements">{t('feedback.improvements_label')}</Label>
            <Textarea
              id="improvements"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder={t('feedback.improvements_placeholder')}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="favoriteFeature">{t('feedback.favorite_label')}</Label>
            <Textarea
              id="favoriteFeature"
              value={favoriteFeature}
              onChange={(e) => setFavoriteFeature(e.target.value)}
              placeholder={t('feedback.favorite_placeholder')}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="issues">{t('feedback.issues_label')}</Label>
            <Textarea
              id="issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder={t('feedback.issues_placeholder')}
              className="mt-2"
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full gap-2">
          <Send className="w-4 h-4" />
          {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
