import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';

interface TrainingRole {
  id: string;
  name: string;
  category: string;
  description: string | null;
  allowed_equipment_categories: string[] | null;
  banned_injury_tags: string[] | null;
  difficulty_level: string | null;
  phase_type: string | null;
  has_bodyweight_variant: boolean | null;
}

interface RoleMuscle {
  id: string;
  role_id: string;
  muscle: string;
  is_primary: boolean | null;
}

const EQUIPMENT_OPTIONS = ['machine', 'cable', 'barbell', 'dumbbell', 'kettlebell', 'plate_loaded', 'bodyweight', 'resistance_band'];
const INJURY_OPTIONS = ['shoulder', 'knees', 'lower_back', 'wrist', 'elbow', 'hip', 'ankle', 'neck'];
const DIFFICULTY_OPTIONS = ['all', 'beginner_safe', 'advanced'];
const PHASE_OPTIONS = ['main', 'warmup', 'cooldown', 'accessory'];
const CATEGORY_GROUPS = ['upper', 'lower', 'core', 'compound', 'cardio'];

const TrainingRolesManagement = () => {
  const [roles, setRoles] = useState<TrainingRole[]>([]);
  const [muscles, setMuscles] = useState<RoleMuscle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newEquipment, setNewEquipment] = useState<Record<string, string>>({});
  const [newInjury, setNewInjury] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    const [rolesRes, musclesRes] = await Promise.all([
      supabase.from('training_roles').select('*').order('category').order('name'),
      supabase.from('role_muscles').select('*').order('role_id'),
    ]);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (musclesRes.data) setMuscles(musclesRes.data);
    setIsLoading(false);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleRole = (id: string) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async (role: TrainingRole) => {
    setSaving(role.id);
    const { error } = await supabase
      .from('training_roles')
      .update({
        allowed_equipment_categories: role.allowed_equipment_categories,
        banned_injury_tags: role.banned_injury_tags,
        difficulty_level: role.difficulty_level,
        phase_type: role.phase_type,
        description: role.description,
      })
      .eq('id', role.id);

    if (error) {
      toast.error(`Chyba: ${error.message}`);
    } else {
      toast.success(`${role.name} uloženo`);
    }
    setSaving(null);
  };

  const addTag = (roleId: string, field: 'allowed_equipment_categories' | 'banned_injury_tags', value: string) => {
    if (!value) return;
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      const current = r[field] || [];
      if (current.includes(value)) return r;
      return { ...r, [field]: [...current, value] };
    }));
  };

  const removeTag = (roleId: string, field: 'allowed_equipment_categories' | 'banned_injury_tags', value: string) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      return { ...r, [field]: (r[field] || []).filter(v => v !== value) };
    }));
  };

  const getRoleMuscles = (roleId: string) => muscles.filter(m => m.role_id === roleId);

  const groupedByCategory = roles.reduce<Record<string, TrainingRole[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

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
        <h2 className="text-2xl font-bold text-foreground">Tréninkové role</h2>
        <p className="text-sm text-muted-foreground">
          Správa training_roles — povolené vybavení, kontraindikovaná zranění, obtížnost.
        </p>

        {CATEGORY_GROUPS.map(cat => {
          const catRoles = groupedByCategory[cat];
          if (!catRoles) return null;
          const isCatExpanded = expandedCategories.has(cat);

          return (
            <Card key={cat} className="p-4">
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-2 w-full text-left"
              >
                {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <h3 className="text-lg font-semibold text-foreground capitalize">{cat}</h3>
                <span className="text-sm text-muted-foreground ml-auto">{catRoles.length} rolí</span>
              </button>

              {isCatExpanded && (
                <div className="mt-3 space-y-2">
                  {catRoles.map(role => {
                    const isExpanded = expandedRoles.has(role.id);
                    const roleMuscles = getRoleMuscles(role.id);
                    const primaryMuscles = roleMuscles.filter(m => m.is_primary);
                    const secondaryMuscles = roleMuscles.filter(m => !m.is_primary);

                    return (
                      <div key={role.id} className="border border-border rounded-lg">
                        <button
                          onClick={() => toggleRole(role.id)}
                          className="flex items-center gap-2 w-full text-left p-3"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span className="font-medium text-sm">{role.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">({role.id})</span>
                          <div className="ml-auto flex gap-1">
                            {(role.allowed_equipment_categories?.length || 0) === 0 && (
                              <Badge variant="destructive" className="text-[10px]">Bez vybavení</Badge>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3">
                            {/* Equipment */}
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Povolené vybavení</label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(role.allowed_equipment_categories || []).map(eq => (
                                  <Badge key={eq} variant="secondary" className="text-xs gap-1">
                                    {eq}
                                    <button onClick={() => removeTag(role.id, 'allowed_equipment_categories', eq)}>
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </Badge>
                                ))}
                                <Select
                                  value=""
                                  onValueChange={(v) => addTag(role.id, 'allowed_equipment_categories', v)}
                                >
                                  <SelectTrigger className="w-28 h-6 text-[10px]">
                                    <SelectValue placeholder="+ přidat" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EQUIPMENT_OPTIONS.filter(o => !(role.allowed_equipment_categories || []).includes(o)).map(o => (
                                      <SelectItem key={o} value={o}>{o}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Injuries */}
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Kontraindikovaná zranění</label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(role.banned_injury_tags || []).map(inj => (
                                  <Badge key={inj} variant="outline" className="text-xs gap-1 border-destructive/50">
                                    {inj}
                                    <button onClick={() => removeTag(role.id, 'banned_injury_tags', inj)}>
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </Badge>
                                ))}
                                <Select
                                  value=""
                                  onValueChange={(v) => addTag(role.id, 'banned_injury_tags', v)}
                                >
                                  <SelectTrigger className="w-28 h-6 text-[10px]">
                                    <SelectValue placeholder="+ přidat" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {INJURY_OPTIONS.filter(o => !(role.banned_injury_tags || []).includes(o)).map(o => (
                                      <SelectItem key={o} value={o}>{o}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Difficulty & Phase */}
                            <div className="flex gap-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Obtížnost</label>
                                <Select
                                  value={role.difficulty_level || 'all'}
                                  onValueChange={(v) => setRoles(prev => prev.map(r => r.id === role.id ? { ...r, difficulty_level: v } : r))}
                                >
                                  <SelectTrigger className="w-32 h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DIFFICULTY_OPTIONS.map(o => (
                                      <SelectItem key={o} value={o}>{o}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Fáze</label>
                                <Select
                                  value={role.phase_type || 'main'}
                                  onValueChange={(v) => setRoles(prev => prev.map(r => r.id === role.id ? { ...r, phase_type: v } : r))}
                                >
                                  <SelectTrigger className="w-32 h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PHASE_OPTIONS.map(o => (
                                      <SelectItem key={o} value={o}>{o}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Muscles */}
                            {roleMuscles.length > 0 && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Svaly</label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {primaryMuscles.map(m => (
                                    <Badge key={m.id} className="text-[10px]">{m.muscle}</Badge>
                                  ))}
                                  {secondaryMuscles.map(m => (
                                    <Badge key={m.id} variant="outline" className="text-[10px]">{m.muscle}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <Button
                              size="sm"
                              onClick={() => handleSave(role)}
                              disabled={saving === role.id}
                              className="w-full"
                            >
                              {saving === role.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                              Uložit změny
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default TrainingRolesManagement;
