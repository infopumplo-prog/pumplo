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
import { toast } from 'sonner';
import LocationPicker from './LocationPicker';
import { useGym, OpeningHours } from '@/hooks/useGym';
import { useTranslation } from 'react-i18next';

const DAYS = [
  { key: 'monday', labelKey: 'business.day_mon' },
  { key: 'tuesday', labelKey: 'business.day_tue' },
  { key: 'wednesday', labelKey: 'business.day_wed' },
  { key: 'thursday', labelKey: 'business.day_thu' },
  { key: 'friday', labelKey: 'business.day_fri' },
  { key: 'saturday', labelKey: 'business.day_sat' },
  { key: 'sunday', labelKey: 'business.day_sun' },
];

interface CreateGymFormProps {
  onSuccess?: () => void;
}

const CreateGymForm = ({ onSuccess }: CreateGymFormProps) => {
  const { t } = useTranslation();

  const formSchema = z.object({
    name: z.string().min(2, t('business.name_min')),
    description: z.string().optional(),
    address: z.string().optional(),
  });

  type FormData = z.infer<typeof formSchema>;

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
      toast.error(t('business.select_location'));
      return;
    }

    setIsSubmitting(true);
    const result = await createGym({
      name: data.name,
      description: data.description,
      address: data.address,
      latitude: location.lat,
      longitude: location.lng,
      opening_hours: openingHours,
    });
    setIsSubmitting(false);

    if (result.success) {
      onSuccess?.();
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('business.gym_name_label')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('business.gym_name_field')}</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('business.gym_name_placeholder')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('business.description')}</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('business.description_placeholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('business.address')}</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder={t('business.address_placeholder')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('business.map_location')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationPicker
            onLocationChange={(lat, lng) => setLocation({ lat, lng })}
          />
          {location && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('business.selected_position', { lat: location.lat.toFixed(5), lng: location.lng.toFixed(5) })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('business.opening_hours')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(day => (
            <div key={day.key} className="flex flex-col gap-2 py-2 border-b border-border last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t(day.labelKey)}</span>
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
                <span className="text-sm text-muted-foreground">{t('business.closed')}</span>
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
            {t('business.creating')}
          </>
        ) : (
          t('business.create_gym_btn')
        )}
      </Button>
    </form>
  );
};

export default CreateGymForm;
