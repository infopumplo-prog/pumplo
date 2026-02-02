import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Pause, X, Play } from 'lucide-react';

interface WorkoutExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnd: () => void;
  onPause: () => void;
  isWarmup?: boolean;
}

export const WorkoutExitDialog = ({
  open,
  onOpenChange,
  onEnd,
  onPause,
  isWarmup = false
}: WorkoutExitDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            {isWarmup ? 'Ukončit rozcvičku?' : 'Ukončit trénink?'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base space-y-2">
            <span className="block">Co chceš udělat?</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 rounded-xl"
            onClick={() => {
              onOpenChange(false);
              onPause();
            }}
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Pause className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Pozastavit</p>
              <p className="text-xs text-muted-foreground">Můžeš pokračovat později</p>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 rounded-xl border-destructive/30 hover:bg-destructive/10"
            onClick={() => {
              onOpenChange(false);
              onEnd();
            }}
          >
            <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-destructive">Ukončit</p>
              <p className="text-xs text-muted-foreground">Progress nebude uložen</p>
            </div>
          </Button>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel className="w-full gap-2 rounded-xl">
            <Play className="w-4 h-4" />
            Pokračovat v tréninku
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
