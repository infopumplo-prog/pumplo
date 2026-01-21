import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MessageSquare, Calendar, ThumbsUp, AlertCircle, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AppFeedback {
  id: string;
  user_id: string;
  experience_rating: number | null;
  satisfaction: string | null;
  improvements: string | null;
  favorite_feature: string | null;
  issues: string | null;
  created_at: string;
}

export default function AppFeedbackList() {
  const [feedback, setFeedback] = useState<AppFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('app_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching feedback:', error);
    } else {
      setFeedback(data || []);
    }
    
    setLoading(false);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'w-4 h-4',
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            )}
          />
        ))}
      </div>
    );
  };

  const averageRating = feedback.length > 0
    ? feedback.filter(f => f.experience_rating).reduce((acc, f) => acc + (f.experience_rating || 0), 0) / 
      feedback.filter(f => f.experience_rating).length
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Zpětná vazba aplikace
          </h1>
          <p className="text-muted-foreground mt-1">
            Celková zpětná vazba od uživatelů k aplikaci
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{feedback.length}</div>
                <div className="text-sm text-muted-foreground">Celkem odpovědí</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold">{averageRating.toFixed(1)}</span>
                  <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                </div>
                <div className="text-sm text-muted-foreground">Průměrné hodnocení</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : feedback.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Žádná zpětná vazba k zobrazení</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedback.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {renderStars(item.experience_rating)}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(item.created_at), 'd. M. yyyy HH:mm', { locale: cs })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.satisfaction && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Spokojenost
                      </div>
                      <p className="text-sm">{item.satisfaction}</p>
                    </div>
                  )}
                  
                  {item.favorite_feature && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Star className="w-3.5 h-3.5" />
                        Oblíbená funkce
                      </div>
                      <p className="text-sm">{item.favorite_feature}</p>
                    </div>
                  )}
                  
                  {item.improvements && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Návrhy na zlepšení
                      </div>
                      <p className="text-sm">{item.improvements}</p>
                    </div>
                  )}
                  
                  {item.issues && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Problémy
                      </div>
                      <p className="text-sm">{item.issues}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
