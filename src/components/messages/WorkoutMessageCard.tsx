import { useNavigate } from 'react-router-dom';
import { Dumbbell, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkoutMessageCardProps {
  planName: string;
  shareToken: string;
  dayCount?: number;
  exerciseCount?: number;
  isMine: boolean;
}

const WorkoutMessageCard = ({ planName, shareToken, dayCount, exerciseCount, isMine }: WorkoutMessageCardProps) => {
  const navigate = useNavigate();

  return (
    <div
      className={`rounded-2xl overflow-hidden border max-w-[72vw] ${
        isMine
          ? 'bg-primary/10 border-primary/30'
          : 'bg-card border-border'
      }`}
    >
      <div className={`px-3 py-2 flex items-center gap-2 ${isMine ? 'bg-primary/15' : 'bg-muted/60'}`}>
        <Dumbbell className="w-3.5 h-3.5 shrink-0 text-primary" />
        <span className="text-xs font-semibold text-primary">Sdílený trénink</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold leading-snug mb-1.5">{planName}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          {dayCount != null && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dayCount} {dayCount === 1 ? 'den' : dayCount < 5 ? 'dny' : 'dní'}
            </span>
          )}
          {exerciseCount != null && (
            <span className="flex items-center gap-1">
              <Dumbbell className="w-3 h-3" />
              {exerciseCount} {exerciseCount === 1 ? 'cvik' : exerciseCount < 5 ? 'cviky' : 'cviků'}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs rounded-lg"
          onClick={() => navigate(`/plan/${shareToken}`)}
        >
          <ExternalLink className="w-3 h-3 mr-1.5" />
          Zobrazit a uložit
        </Button>
      </div>
    </div>
  );
};

export default WorkoutMessageCard;
