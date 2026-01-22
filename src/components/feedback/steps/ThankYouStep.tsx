import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedbackContext } from '../hooks/useFeedbackContext';
import { toast } from 'sonner';
import type { FeedbackData } from '../types';

interface ThankYouStepProps {
  data: Partial<FeedbackData>;
  onClose: () => void;
}

export const ThankYouStep = ({ data, onClose }: ThankYouStepProps) => {
  const { user } = useAuth();
  const context = useFeedbackContext();
  
  const [canContact, setCanContact] = useState(false);
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);

    const payload = {
      user_id: user.id,
      feedback_type: data.feedback_type,
      message: data.message,
      responses: data.responses || {},
      
      // Context
      app_version: context.app_version,
      platform: context.platform,
      locale: context.locale,
      timezone: context.timezone,
      current_route: context.current_route,
      
      // Workout context
      plan_id: data.plan_id || context.plan_id,
      week_index: data.week_index || context.week_index,
      day_index: data.day_index || context.day_index,
      day_letter: data.day_letter,
      workout_id: data.workout_id,
      exercise_id: data.exercise_id,
      gym_id: data.gym_id || context.gym_id,
      
      // Bug context
      last_action: data.last_action,
      error_code: data.error_code,
      error_message: data.error_message,
      screenshot_url: data.screenshot_url,
      
      // Contact
      can_contact: canContact,
      contact_email: canContact ? contactEmail : null,
    };

    const { error } = await supabase
      .from('user_feedback')
      .insert(payload as never);

    setIsSubmitting(false);

    if (error) {
      console.error('Feedback submission error:', error);
      toast.error('Chyba při odesílání');
    } else {
      setSubmitted(true);
      toast.success('Odesláno. Díky!');
      setTimeout(onClose, 1500);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-16 h-16 text-chart-2 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Díky za feedback! 🙌</h2>
        <p className="text-muted-foreground">Tvůj podnět jsme přijali.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Díky za feedback 🙌</h3>
        <p className="text-sm text-muted-foreground">
          Všechny podněty čteme a používáme k vylepšení Pumpla.
          {data.feedback_type === 'bug_error' && (
            <><br />Pokud jde o chybu, podíváme se na ni co nejdříve.</>
          )}
        </p>
      </div>

      <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
        <div className="flex items-start gap-3">
          <Checkbox
            id="contact"
            checked={canContact}
            onCheckedChange={(checked) => setCanContact(checked === true)}
          />
          <Label htmlFor="contact" className="text-sm cursor-pointer leading-relaxed">
            Můžeme tě kontaktovat, pokud budeme potřebovat upřesnění?
          </Label>
        </div>

        {canContact && (
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="tvuj@email.cz"
              className="mt-1"
            />
          </div>
        )}
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={isSubmitting}
        className="w-full gap-2"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {isSubmitting ? 'Odesílám...' : 'Odeslat'}
      </Button>
    </div>
  );
};
