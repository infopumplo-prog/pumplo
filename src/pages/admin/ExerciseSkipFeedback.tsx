import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from './AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SkipForward, Filter, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface SkipFeedback {
  id: string;
  exercise_name: string;
  reason: string;
  other_reason: string | null;
  created_at: string;
  gym_id: string | null;
  day_letter: string | null;
  user_id: string;
}

interface Gym {
  id: string;
  name: string;
}

export default function ExerciseSkipFeedback() {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<SkipFeedback[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGym, setSelectedGym] = useState<string>('all');
  const [selectedReason, setSelectedReason] = useState<string>('all');

  const REASON_LABELS: Record<string, string> = {
    too_difficult: t('admin.reason_too_difficult'),
    dont_want: t('admin.reason_dont_want'),
    health: t('admin.reason_health'),
    machine_missing: t('admin.reason_machine_missing'),
    other: t('admin.reason_other'),
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [selectedGym, selectedReason]);

  const fetchGyms = async () => {
    const { data } = await supabase
      .from('gyms')
      .select('id, name')
      .order('name');

    if (data) {
      setGyms(data);
    }
  };

  const fetchFeedback = async () => {
    setLoading(true);

    let query = supabase
      .from('exercise_skip_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (selectedGym !== 'all') {
      query = query.eq('gym_id', selectedGym);
    }

    if (selectedReason !== 'all') {
      query = query.eq('reason', selectedReason);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching feedback:', error);
    } else {
      setFeedback(data || []);
    }

    setLoading(false);
  };

  const getReasonBadgeVariant = (reason: string) => {
    switch (reason) {
      case 'machine_missing': return 'destructive';
      case 'health': return 'secondary';
      case 'too_difficult': return 'outline';
      default: return 'default';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SkipForward className="w-6 h-6 text-primary" />
            {t('admin.skip_feedback_title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.skip_feedback_desc')}
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('admin.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm text-muted-foreground mb-1.5 block">{t('admin.gym_label')}</label>
                <Select value={selectedGym} onValueChange={setSelectedGym}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.all_gyms')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.all_gyms')}</SelectItem>
                    {gyms.map(gym => (
                      <SelectItem key={gym.id} value={gym.id}>{gym.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm text-muted-foreground mb-1.5 block">{t('admin.reason_label')}</label>
                <Select value={selectedReason} onValueChange={setSelectedReason}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.all_reasons')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.all_reasons')}</SelectItem>
                    {Object.entries(REASON_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : feedback.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <SkipForward className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('admin.no_feedback')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.exercise_col')}</TableHead>
                    <TableHead>{t('admin.reason_col')}</TableHead>
                    <TableHead>{t('admin.day_col')}</TableHead>
                    <TableHead>{t('admin.date_col')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.exercise_name}</TableCell>
                      <TableCell>
                        <Badge variant={getReasonBadgeVariant(item.reason)}>
                          {REASON_LABELS[item.reason] || item.reason}
                        </Badge>
                        {item.other_reason && (
                          <p className="text-xs text-muted-foreground mt-1">{item.other_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.day_letter && (
                          <Badge variant="outline">{t('admin.day_letter', { letter: item.day_letter })}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(item.created_at), 'd. M. yyyy HH:mm', { locale: cs })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
