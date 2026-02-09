import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const DayTemplatesManagement = () => {
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [roles, setRoles] = useState<TrainingRole[]>([]);
  const [goals, setGoals] = useState<TrainingGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingSlot, setEditingSlot] = useState<DayTemplate | null>(null);

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

  const handleSave = async (template: DayTemplate) => {
    setSaving(template.id);
    const { error } = await supabase
      .from('day_templates')
      .update({
        role_id: template.role_id,
        beginner_sets: template.beginner_sets,
        intermediate_sets: template.intermediate_sets,
        advanced_sets: template.advanced_sets,
        rep_min: template.rep_min,
        rep_max: template.rep_max,
        day_name: template.day_name,
      })
      .eq('id', template.id);

    if (error) {
      toast.error(`Chyba: ${error.message}`);
    } else {
      toast.success('Uloženo');
      setEditingSlot(null);
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

  const updateLocal = (id: string, field: keyof DayTemplate, value: string | number | null) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    if (editingSlot?.id === id) {
      setEditingSlot(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || roleId;

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
                      <div className="space-y-2 ml-4">
                        {slots.sort((a, b) => a.slot_order - b.slot_order).map(slot => (
                          <div key={slot.id} className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                            <span className="text-muted-foreground w-6 text-center font-mono">
                              #{slot.slot_order}
                            </span>

                            <Select
                              value={slot.role_id}
                              onValueChange={(v) => updateLocal(slot.id, 'role_id', v)}
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
                                value={slot.beginner_sets}
                                onChange={(e) => updateLocal(slot.id, 'beginner_sets', parseInt(e.target.value) || 0)}
                                className="w-12 h-8 text-xs text-center"
                              />
                              <span className="text-xs text-muted-foreground">I:</span>
                              <Input
                                type="number"
                                value={slot.intermediate_sets}
                                onChange={(e) => updateLocal(slot.id, 'intermediate_sets', parseInt(e.target.value) || 0)}
                                className="w-12 h-8 text-xs text-center"
                              />
                              <span className="text-xs text-muted-foreground">A:</span>
                              <Input
                                type="number"
                                value={slot.advanced_sets}
                                onChange={(e) => updateLocal(slot.id, 'advanced_sets', parseInt(e.target.value) || 0)}
                                className="w-12 h-8 text-xs text-center"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={slot.rep_min ?? ''}
                                onChange={(e) => updateLocal(slot.id, 'rep_min', parseInt(e.target.value) || null)}
                                className="w-12 h-8 text-xs text-center"
                                placeholder="min"
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                type="number"
                                value={slot.rep_max ?? ''}
                                onChange={(e) => updateLocal(slot.id, 'rep_max', parseInt(e.target.value) || null)}
                                className="w-12 h-8 text-xs text-center"
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
                        ))}

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
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
