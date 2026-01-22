import { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { 
  Dumbbell, 
  Bug, 
  Lightbulb, 
  HelpCircle, 
  MessageSquare,
  Filter,
  ChevronDown,
  ChevronUp,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FeedbackType = 'training_exercises' | 'bug_error' | 'missing_feature' | 'confusion' | 'other';
type FeedbackStatus = 'new' | 'in_progress' | 'fixed' | 'wont_fix';

interface UserFeedback {
  id: string;
  user_id: string;
  feedback_type: FeedbackType;
  message: string | null;
  responses: Record<string, unknown>;
  current_route: string | null;
  gym_id: string | null;
  exercise_id: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  can_contact: boolean;
  contact_email: string | null;
  created_at: string;
}

const typeConfig: Record<FeedbackType, { label: string; icon: React.ElementType; color: string }> = {
  training_exercises: { label: 'Trénink', icon: Dumbbell, color: 'bg-blue-500/10 text-blue-500' },
  bug_error: { label: 'Bug', icon: Bug, color: 'bg-red-500/10 text-red-500' },
  missing_feature: { label: 'Feature', icon: Lightbulb, color: 'bg-yellow-500/10 text-yellow-500' },
  confusion: { label: 'Zmatení', icon: HelpCircle, color: 'bg-purple-500/10 text-purple-500' },
  other: { label: 'Jiné', icon: MessageSquare, color: 'bg-muted text-muted-foreground' },
};

const statusConfig: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'Nový', color: 'bg-blue-500' },
  in_progress: { label: 'Řeší se', color: 'bg-yellow-500' },
  fixed: { label: 'Vyřešeno', color: 'bg-green-500' },
  wont_fix: { label: 'Neřeší se', color: 'bg-muted-foreground' },
};

export default function UserFeedbackList() {
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FeedbackType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching feedback:', error);
    } else {
      setFeedback((data as UserFeedback[]) || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    const { error } = await supabase
      .from('user_feedback')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Chyba při aktualizaci');
    } else {
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      toast.success('Status aktualizován');
    }
  };

  const saveNotes = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from('user_feedback')
      .update({ admin_notes: editingNotes[id] })
      .eq('id', id);

    setSavingId(null);
    if (error) {
      toast.error('Chyba při ukládání');
    } else {
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, admin_notes: editingNotes[id] } : f));
      toast.success('Poznámka uložena');
    }
  };

  const filteredFeedback = feedback.filter(f => {
    if (filterType !== 'all' && f.feedback_type !== filterType) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: feedback.length,
    new: feedback.filter(f => f.status === 'new').length,
    bugs: feedback.filter(f => f.feedback_type === 'bug_error').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Celkem</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{stats.new}</div>
              <div className="text-xs text-muted-foreground">Nových</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{stats.bugs}</div>
              <div className="text-xs text-muted-foreground">Bugů</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtry
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FeedbackType | 'all')}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny typy</SelectItem>
                {Object.entries(typeConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FeedbackStatus | 'all')}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny statusy</SelectItem>
                {Object.entries(statusConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Feedback List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredFeedback.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Žádný feedback nenalezen
              </CardContent>
            </Card>
          ) : (
            filteredFeedback.map((item) => {
              const config = typeConfig[item.feedback_type];
              const statusCfg = statusConfig[item.status];
              const isExpanded = expandedId === item.id;
              const Icon = config.icon;

              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="pt-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg', config.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{config.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(item.created_at), 'd. M. yyyy HH:mm', { locale: cs })}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <span className={cn('w-2 h-2 rounded-full mr-1.5', statusCfg.color)} />
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Message */}
                    {item.message && (
                      <p className="text-sm bg-muted/50 p-3 rounded-lg">
                        {item.message}
                      </p>
                    )}

                    {/* Context badges */}
                    <div className="flex flex-wrap gap-1">
                      {item.current_route && (
                        <Badge variant="secondary" className="text-xs">
                          {item.current_route}
                        </Badge>
                      )}
                      {item.can_contact && (
                        <Badge variant="secondary" className="text-xs">
                          📧 {item.contact_email}
                        </Badge>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isExpanded ? 'Skrýt detaily' : 'Zobrazit detaily'}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t">
                        {/* Responses JSON */}
                        {Object.keys(item.responses).length > 0 && (
                          <div>
                            <div className="text-xs font-medium mb-1">Odpovědi:</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(item.responses, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Status update */}
                        <div>
                          <div className="text-xs font-medium mb-1">Změnit status:</div>
                          <div className="flex gap-1 flex-wrap">
                            {(Object.keys(statusConfig) as FeedbackStatus[]).map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                variant={item.status === status ? 'default' : 'outline'}
                                className="text-xs h-7"
                                onClick={() => updateStatus(item.id, status)}
                              >
                                {statusConfig[status].label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Admin notes */}
                        <div>
                          <div className="text-xs font-medium mb-1">Admin poznámky:</div>
                          <Textarea
                            value={editingNotes[item.id] ?? item.admin_notes ?? ''}
                            onChange={(e) => setEditingNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Interní poznámky..."
                            className="text-sm"
                            rows={2}
                          />
                          <Button
                            size="sm"
                            className="mt-2 gap-1"
                            onClick={() => saveNotes(item.id)}
                            disabled={savingId === item.id}
                          >
                            <Save className="w-3 h-3" />
                            Uložit
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
