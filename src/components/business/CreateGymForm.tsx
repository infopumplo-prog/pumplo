import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import LocationPicker from './LocationPicker';
import { useGym, OpeningHours } from '@/hooks/useGym';

const formSchema = z.object({
  name: z.string().min(2, 'Názov musí mať aspoň 2 znaky'),
  description: z.string().optional(),
  address: z.string().optional(),
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

const CreateGymForm = () => {
  const { createGym } = useGym();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [openingHours, setOpeningHours] = useState<OpeningHours>(
    DAYS.reduce((acc, day) => ({
      ...acc,
      [day.key]: { open: '06:00', close: '22:00', closed: false },
    }), {})
  );

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const updateOpeningHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const onSubmit = async (data: FormData) => {
    if (!location) {
      return;
    }

    setIsSubmitting(true);
    await createGym({
      name: data.name,
      description: data.description,
      address: data.address,
      latitude: location.lat,
      longitude: location.lng,
      opening_hours: openingHours,
    });
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Základné informácie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Názov posilňovne *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Napr. FitZone Gym"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Popis</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Popíšte svoju posilňovňu..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresa</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Napr. Hlavná 123, Bratislava"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lokácia na mape *</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationPicker
            onLocationChange={(lat, lng) => setLocation({ lat, lng })}
          />
          {location && (
            <p className="text-sm text-muted-foreground mt-2">
              Vybraná pozícia: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Otváracie hodiny</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS.map(day => (
            <div key={day.key} className="flex items-center gap-3">
              <div className="w-24 text-sm font-medium">{day.label}</div>
              <Switch
                checked={!openingHours[day.key]?.closed}
                onCheckedChange={(checked) => updateOpeningHours(day.key, 'closed', !checked)}
              />
              {!openingHours[day.key]?.closed ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={openingHours[day.key]?.open || '06:00'}
                    onChange={(e) => updateOpeningHours(day.key, 'open', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={openingHours[day.key]?.close || '22:00'}
                    onChange={(e) => updateOpeningHours(day.key, 'close', e.target.value)}
                    className="w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Zatvorené</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isSubmitting || !location}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Vytváranie...
          </>
        ) : (
          'Vytvoriť posilňovňu'
        )}
      </Button>
    </form>
  );
};

export default CreateGymForm;
