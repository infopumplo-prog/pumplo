import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LocationPicker from '@/components/business/LocationPicker';

interface OpeningHours {
  [day: string]: { open: string; close: string; closed: boolean };
}

interface BusinessUser {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

const formSchema = z.object({
  name: z.string().min(2, 'Názov musí mať aspoň 2 znaky'),
  description: z.string().optional(),
  address: z.string().optional(),
  owner_id: z.string().min(1, 'Vyberte majiteľa'),
});

type FormData = z.infer<typeof formSchema>;

const DAYS = [
  { key: 'monday', label: 'Pondelok' },
  { key: 'tuesday', label: 'Utorok' },
  { key: 'wednesday', label: 'Streda' },
  { key: 'thursday', label: 'Štvrtok' },
  { key: 'friday', label: 'Piatok' },
  { key: 'saturday', label: 'Sobota' },
  { key: 'sunday', label: 'Nedeľa' },
];

interface AdminCreateGymFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const AdminCreateGymForm = ({ onSuccess, onCancel }: AdminCreateGymFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessUsers, setBusinessUsers] = useState<BusinessUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [openingHours, setOpeningHours] = useState<OpeningHours>(
    DAYS.reduce((acc, day) => ({
      ...acc,
      [day.key]: { open: '06:00', close: '22:00', closed: false },
    }), {})
  );

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const selectedOwnerId = watch('owner_id');

  useEffect(() => {
    const fetchBusinessUsers = async () => {
      setIsLoadingUsers(true);
      
      // Fetch users with business role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'business');

      if (rolesError) {
        console.error('Error fetching business roles:', rolesError);
        setIsLoadingUsers(false);
        return;
      }

      if (!roles || roles.length === 0) {
        setBusinessUsers([]);
        setIsLoadingUsers(false);
        return;
      }

      // Fetch profiles for business users
      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      setBusinessUsers(profiles || []);
      setIsLoadingUsers(false);
    };

    fetchBusinessUsers();
  }, []);

  const updateOpeningHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const onSubmit = async (data: FormData) => {
    if (!location) {
      toast.error('Vyberte prosím lokáciu na mape');
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('gyms')
      .insert({
        owner_id: data.owner_id,
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        latitude: location.lat,
        longitude: location.lng,
        opening_hours: openingHours,
        is_published: false,
      });

    setIsSubmitting(false);
    
    if (error) {
      console.error('Error creating gym:', error);
      toast.error('Nepodarilo sa vytvoriť posilovňu');
      return;
    }

    toast.success('Posilovňa bola vytvorená');
    onSuccess?.();
  };

  const getOwnerDisplayName = (user: BusinessUser) => {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || 'Bez mena';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Owner Selection */}
      <div className="space-y-2">
        <Label>Majiteľ (business používateľ) *</Label>
        {isLoadingUsers ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Načítavam...</span>
          </div>
        ) : businessUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Žiadni business používatelia. Najprv vytvorte používateľa s business rolou.
          </p>
        ) : (
          <Select onValueChange={(value) => setValue('owner_id', value)} value={selectedOwnerId}>
            <SelectTrigger>
              <SelectValue placeholder="Vyberte majiteľa" />
            </SelectTrigger>
            <SelectContent className="z-[200]">
              {businessUsers.map((user) => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {getOwnerDisplayName(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors.owner_id && (
          <p className="text-sm text-destructive">{errors.owner_id.message}</p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Názov posilovne *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Napr. FitZone Gym"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Popis</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Popíšte posilovňu..."
          rows={3}
        />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address">Adresa</Label>
        <Input
          id="address"
          {...register('address')}
          placeholder="Napr. Hlavná 123, Bratislava"
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label>Lokácia na mape *</Label>
        <LocationPicker
          onLocationChange={(lat, lng) => setLocation({ lat, lng })}
        />
        {location && (
          <p className="text-sm text-muted-foreground">
            Vybraná pozícia: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>
        )}
      </div>

      {/* Opening Hours */}
      <div className="space-y-3">
        <Label>Otváracie hodiny</Label>
        {DAYS.map(day => (
          <div key={day.key} className="flex flex-col gap-2 py-2 border-b border-border last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{day.label}</span>
              <Switch
                checked={!openingHours[day.key]?.closed}
                onCheckedChange={(checked) => updateOpeningHours(day.key, 'closed', !checked)}
              />
            </div>
            {!openingHours[day.key]?.closed ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={openingHours[day.key]?.open || '06:00'}
                  onChange={(e) => updateOpeningHours(day.key, 'open', e.target.value)}
                  className="flex-1"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={openingHours[day.key]?.close || '22:00'}
                  onChange={(e) => updateOpeningHours(day.key, 'close', e.target.value)}
                  className="flex-1"
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Zatvorené</span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          type="submit" 
          className="flex-1" 
          disabled={isSubmitting || !location || businessUsers.length === 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Vytváram...
            </>
          ) : (
            'Vytvoriť posilovňu'
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Zrušiť
          </Button>
        )}
      </div>
    </form>
  );
};

export default AdminCreateGymForm;
