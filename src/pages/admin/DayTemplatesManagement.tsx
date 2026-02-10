import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';

interface DayTemplate {
  id: string;
  goal_id: string;
  split_type: string | null;
  day_letter: string;
  day_name: string;
  slot_order: number;
  role_id: string;
  beginner_sets: number;
  intermediate_sets: number;
  advanced_sets: number;
  rep_min: number | null;
  rep_max: number | null;
}

interface TrainingRole {
  id: string;
  name: string;
}

interface TrainingGoal {
  id: string;
  name: string;
}

const SPLIT_TYPES = ['full_body', 'upper_lower', 'ppl'];

const GOAL_STYLES: Record<string, { label: string; className: string }> = {
  strength: { label: 'Síla', className: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' },
  muscle_gain: { label: 'Svaly', className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700' },
  fat_loss: { label: 'Hubnutí', className: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700' },
  general_fitness: { label: 'Kondice', className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700' },
};

// Local state uses strings to allow empty inputs
interface LocalValues {
  [id: string]: {
    beginner_sets?: string;
    intermediate_sets?: string;
    advanced_sets?: string;
    rep_min?: string;
    rep_max?: string;
  };
}

const DayTemplatesManagement = () => {
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [roles, setRoles] = useState<TrainingRole[]>([]);
  const [goals, setGoals] = useState<TrainingGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [localValues, setLocalValues] = useState<LocalValues>({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    const [templatesRes, rolesRes, goalsRes] = await Promise.all([
      supabase.from('day_templates').select('*').order('split_type').order('day_letter').order('slot_order'),
      supabase.from('training_roles').select('id, name').order('name'),
      supabase.from('training_goals').select('id, name'),
    ]);
    if (templatesRes.data) setTemplates(templatesRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
    setIsLoading(false);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const grouped = templates.reduce<Record<string, Record<string, DayTemplate[]>>>((acc, t) => {
    const split = t.split_type || 'unknown';
    const day = t.day_letter;
    if (!acc[split]) acc[split] = {};
    if (!acc[split][day]) acc[split][day] = [];
    acc[split][day].push(t);
    return acc;
  }, {});

  const getLocalNum = (id: string, field: string, dbValue: number | null): string => {
    const local = localValues[id]?.[field as keyof typeof localValues[string]];
    if (local !== undefined) return local;
    return dbValue !== null && dbValue !== undefined ? String(dbValue) : '';
  };

  const setLocalField = (id: string, field: string, value: string) => {
    setLocalValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (template: DayTemplate) => {
    const local = localValues[template.id] || {};
    const beginner_sets = parseInt(local.beginner_sets ?? String(template.beginner_sets)) || 0;
    const intermediate_sets = parseInt(local.intermediate_sets ?? String(template.intermediate_sets)) || 0;
    const advanced_sets = parseInt(local.advanced_sets ?? String(template.advanced_sets)) || 0;
    const rep_min = parseInt(local.rep_min ?? String(template.rep_min ?? '')) || null;
    const rep_max = parseInt(local.rep_max ?? String(template.rep_max ?? '')) || null;

    setSaving(template.id);
    const { error } = await supabase
      .from('day_templates')
      .update({
        role_id: template.role_id,
        beginner_sets,
        intermediate_sets,
        advanced_sets,
        rep_min,
        rep_max,
        day_name: template.day_name,
      })
      .eq('id', template.id);

    if (error) {
      toast.error(`Chyba: ${error.message}`);
    } else {
      toast.success('Uloženo');
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max } : t));
      setLocalValues(prev => { const next = { ...prev }; delete next[template.id]; return next; });
    }
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('day_templates').delete().eq('id', id);
    if (error) {
      toast.error(`Chyba: ${error.message}`);
    } else {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Slot odstraněn');
    }
  };

  const handleAddSlot = async (splitType: string, dayLetter: string, goalId: string, dayName: string) => {
    const existing = templates.filter(t => t.split_type === splitType && t.day_letter === dayLetter && t.goal_id === goalId);
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.slot_order)) : 0;

    const { data, error } = await supabase.from('day_templates').insert({
      split_type: splitType,
      day_letter: dayLetter,
      day_name: dayName,
      goal_id: goalId,
      slot_order: maxOrder + 1,
      role_id: roles[0]?.id || 'horizontal_push',
      beginner_sets: 2,
      intermediate_sets: 3,
      advanced_sets: 4,
      rep_min: 8,
      rep_max: 12,
    }).select().single();

    if (error) {
      toast.error(`Chyba: ${error.message}`);
    } else if (data) {
      setTemplates(prev => [...prev, data]);
      toast.success('Slot přidán');
    }
  };

  const updateRoleLocal = (id: string, value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, role_id: value } : t));
  };

  const getGoalStyle = (goalId: string) => GOAL_STYLES[goalId] || { label: goalId, className: 'bg-muted text-muted-foreground' };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Šablony tréninků</h2>
        <p className="text-sm text-muted-foreground">
          Správa day_templates — jaké role jsou v kterém dni, kolik sérií a opakování.
        </p>

        {SPLIT_TYPES.map(splitType => {
          const days = grouped[splitType];
          if (!days) return null;
          const splitKey = `split-${splitType}`;
          const isExpanded = expandedGroups.has(splitKey);

          return (
            <Card key={splitType} className="p-4">
              <button
                onClick={() => toggleGroup(splitKey)}
                className="flex items-center gap-2 w-full text-left"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <h3 className="text-lg font-semibold text-foreground">{splitType}</h3>
                <span className="text-sm text-muted-foreground ml-auto">
                  {Object.keys(days).length} dnů, {Object.values(days).flat().length} slotů
                </span>
              </button>

              {isExpanded && Object.entries(days).sort().map(([dayLetter, slots]) => {
                const dayKey = `${splitType}-${dayLetter}`;
                const isDayExpanded = expandedGroups.has(dayKey);
                const firstSlot = slots[0];

                // Group slots by slot_order
                const byOrder: Record<number, DayTemplate[]> = {};
                slots.forEach(s => {
                  if (!byOrder[s.slot_order]) byOrder[s.slot_order] = [];
                  byOrder[s.slot_order].push(s);
                });
                const sortedOrders = Object.keys(byOrder).map(Number).sort((a, b) => a - b);

                return (
                  <div key={dayLetter} className="mt-3 ml-4">
                    <button
                      onClick={() => toggleGroup(dayKey)}
                      className="flex items-center gap-2 w-full text-left mb-2"
                    >
                      {isDayExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span className="font-medium text-foreground">
                        Den {dayLetter}: {firstSlot?.day_name}
                      </span>
                      <span className="text-xs text-muted-foreground">({slots.length} slotů)</span>
                    </button>

                    {isDayExpanded && (
                      <div className="space-y-1 ml-4">
                        {sortedOrders.map((order, orderIdx) => {
                          const group = byOrder[order];
                          const goalOrder = ['strength', 'muscle_gain', 'fat_loss', 'general_fitness'];
                          const sorted = [...group].sort((a, b) => goalOrder.indexOf(a.goal_id) - goalOrder.indexOf(b.goal_id));

                          return (
                            <div key={order}>
                              {orderIdx > 0 && <Separator className="my-2" />}
                              <div className="space-y-1">
                                {sorted.map(slot => {
                                  const goalStyle = getGoalStyle(slot.goal_id);
                                  return (
                                    <div key={slot.id} className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                                      <span className="text-muted-foreground w-6 text-center font-mono">
                                        #{slot.slot_order}
                                      </span>

                                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 min-w-[52px] text-center justify-center ${goalStyle.className}`}>
                                        {goalStyle.label}
                                      </Badge>

                                      <Select
                                        value={slot.role_id}
                                        onValueChange={(v) => updateRoleLocal(slot.id, v)}
                                      >
                                        <SelectTrigger className="w-44 h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {roles.map(r => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>

                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">B:</span>
                                        <Input
                                          type="number"
                                          value={getLocalNum(slot.id, 'beginner_sets', slot.beginner_sets)}
                                          onChange={(e) => setLocalField(slot.id, 'beginner_sets', e.target.value)}
                                          className="w-14 h-8 text-xs text-center px-1 py-0"
                                        />
                                        <span className="text-xs text-muted-foreground">I:</span>
                                        <Input
                                          type="number"
                                          value={getLocalNum(slot.id, 'intermediate_sets', slot.intermediate_sets)}
                                          onChange={(e) => setLocalField(slot.id, 'intermediate_sets', e.target.value)}
                                          className="w-14 h-8 text-xs text-center px-1 py-0"
                                        />
                                        <span className="text-xs text-muted-foreground">A:</span>
                                        <Input
                                          type="number"
                                          value={getLocalNum(slot.id, 'advanced_sets', slot.advanced_sets)}
                                          onChange={(e) => setLocalField(slot.id, 'advanced_sets', e.target.value)}
                                          className="w-14 h-8 text-xs text-center px-1 py-0"
                                        />
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          value={getLocalNum(slot.id, 'rep_min', slot.rep_min)}
                                          onChange={(e) => setLocalField(slot.id, 'rep_min', e.target.value)}
                                          className="w-14 h-8 text-xs text-center px-1 py-0"
                                          placeholder="min"
                                        />
                                        <span className="text-muted-foreground">-</span>
                                        <Input
                                          type="number"
                                          value={getLocalNum(slot.id, 'rep_max', slot.rep_max)}
                                          onChange={(e) => setLocalField(slot.id, 'rep_max', e.target.value)}
                                          className="w-14 h-8 text-xs text-center px-1 py-0"
                                          placeholder="max"
                                        />
                                      </div>

                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleSave(slot)}
                                        disabled={saving === slot.id}
                                      >
                                        {saving === slot.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-destructive"
                                        onClick={() => handleDelete(slot.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs mt-2"
                          onClick={() => handleAddSlot(splitType, dayLetter, firstSlot.goal_id, firstSlot.day_name)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Přidat slot
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default DayTemplatesManagement;
