import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Clock, Dumbbell, Weight, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WorkoutSet {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
}

interface WorkoutSessionCardProps {
  session: {
    id: string;
    day_letter: string;
    goal_id: string;
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    total_sets: number | null;
    total_reps: number | null;
    total_weight_kg: number | null;
  };
  variant?: 'compact' | 'full';
}

export const WorkoutSessionCard = ({ session, variant = 'full' }: WorkoutSessionCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(false);

  // Format day letter for display
  const isExtension = session.day_letter.includes('_EXT');
  const displayLetter = isExtension 
    ? `${session.day_letter.replace('_EXT', '')}+` 
    : session.day_letter;
  const displayTitle = isExtension
    ? `Den ${session.day_letter.replace('_EXT', '')} (rozšírenie)`
    : `Den ${session.day_letter}`;

  // Fetch sets when expanded
  useEffect(() => {
    const fetchSets = async () => {
      if (!isExpanded || sets.length > 0) return;
      
      setIsLoadingSets(true);
      try {
        const { data, error } = await supabase
          .from('workout_session_sets')
          .select('*')
          .eq('session_id', session.id)
          .order('exercise_name', { ascending: true })
          .order('set_number', { ascending: true });

        if (!error && data) {
          setSets(data);
        }
      } catch (err) {
        console.error('Error fetching sets:', err);
      } finally {
        setIsLoadingSets(false);
      }
    };

    fetchSets();
  }, [isExpanded, session.id, sets.length]);

  // Group sets by exercise
  const exerciseGroups = sets.reduce((acc, set) => {
    const key = set.exercise_name;
    if (!acc[key]) {
      acc[key] = {
        exerciseName: set.exercise_name,
        exerciseId: set.exercise_id,
        sets: [],
      };
    }
    acc[key].sets.push(set);
    return acc;
  }, {} as Record<string, { exerciseName: string; exerciseId: string | null; sets: WorkoutSet[] }>);

  const durationMinutes = Math.round((session.duration_seconds || 0) / 60);
  const estimatedCalories = Math.round(durationMinutes * 5);

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all cursor-pointer",
        isExpanded && "ring-1 ring-primary/20"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-xl flex items-center justify-center",
              variant === 'compact' ? "w-10 h-10" : "w-12 h-12",
              isExtension ? "bg-amber-500/10" : "bg-primary/10"
            )}>
              <span className={cn(
                "font-bold",
                variant === 'compact' ? "text-base" : "text-lg",
                isExtension ? "text-amber-600" : "text-primary"
              )}>
                {displayLetter}
              </span>
            </div>
            <div>
              <p className="font-semibold text-foreground">{displayTitle}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(session.started_at), variant === 'compact' ? 'd.M.' : 'EEEE d. MMMM', { locale: cs })}
                {variant === 'full' && ` • ${format(new Date(session.started_at), 'HH:mm')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {variant === 'full' && (
              <div className="text-right mr-2">
                <p className="font-semibold text-foreground">{durationMinutes} min</p>
                <p className="text-sm text-muted-foreground">{session.total_sets || 0} sérií</p>
              </div>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          </div>
        </div>

        {/* Stats Row - compact version */}
        {variant === 'compact' && (
          <div className="grid grid-cols-3 gap-2 text-sm mt-3">
            <div className="text-center">
              <p className="font-semibold text-foreground">{durationMinutes} min</p>
              <p className="text-xs text-muted-foreground">Čas</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{session.total_sets || 0}</p>
              <p className="text-xs text-muted-foreground">Série</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{session.total_weight_kg || 0} kg</p>
              <p className="text-xs text-muted-foreground">Váha</p>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pt-4 mt-4 border-t border-border space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-sm font-semibold">{durationMinutes}</p>
                    <p className="text-xs text-muted-foreground">min</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Dumbbell className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-sm font-semibold">{session.total_sets || 0}</p>
                    <p className="text-xs text-muted-foreground">sérií</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Weight className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-sm font-semibold">{session.total_weight_kg || 0}</p>
                    <p className="text-xs text-muted-foreground">kg</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                    <p className="text-sm font-semibold">{estimatedCalories}</p>
                    <p className="text-xs text-muted-foreground">kcal</p>
                  </div>
                </div>

                {/* Exercises List */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Cviky</h4>
                  {isLoadingSets ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : Object.values(exerciseGroups).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Žádné záznamy
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {Object.values(exerciseGroups).map((group, index) => {
                        const completedSets = group.sets.filter(s => s.completed);
                        const maxWeight = Math.max(...group.sets.map(s => s.weight_kg || 0));
                        const totalReps = group.sets.reduce((acc, s) => acc + (s.reps || 0), 0);
                        
                        return (
                          <div 
                            key={index}
                            className="bg-muted/30 rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{group.exerciseName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {completedSets.length} sérií • {totalReps} opakování
                                  {maxWeight > 0 && ` • max ${maxWeight} kg`}
                                </p>
                              </div>
                            </div>
                            
                            {/* Individual Sets */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {group.sets.map((set, setIndex) => (
                                <Badge 
                                  key={setIndex}
                                  variant={set.completed ? "secondary" : "outline"}
                                  className={cn(
                                    "text-xs",
                                    !set.completed && "opacity-50"
                                  )}
                                >
                                  {set.weight_kg ? `${set.weight_kg}kg` : '—'} × {set.reps || 0}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};