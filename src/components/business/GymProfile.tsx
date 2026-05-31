/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Separator } from '@/components/ui/separator';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer';
import { Loader2, Clock, Pencil, Image } from 'lucide-react';
import LocationPicker from './LocationPicker';
import GymImageUpload from './GymImageUpload';
import GymProfilePreview from './GymProfilePreview';
import GymPhotosManager from './GymPhotosManager';
import GymPricingEditor from './GymPricingEditor';
import { useGym, Gym, OpeningHours } from '@/hooks/useGym';
import { GymPricing } from '@/contexts/GymContext';
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

interface GymProfileProps {
  gym: Gym;
}

const GymProfile = ({ gym }: GymProfileProps) => {
  const { t } = useTranslation();
  const formSchema = z.object({
    name: z.string().min(2, t('business.name_min')),
    description: z.string().optional(),
    address: z.string().optional(),
    instagram_handle: z.string().optional(),
  });
  type FormData = z.infer<typeof formSchema>;
  const { updateGym, togglePublish } = useGym();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPhotoDrawerOpen, setIsPhotoDrawerOpen] = useState(false);
  const [location, setLocation] = useState({ lat: gym.latitude, lng: gym.longitude });
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(gym.cover_photo_url);
  const [logoUrl, setLogoUrl] = useState(gym.logo_url);
   const [pricing, setPricing] = useState<GymPricing | null>(gym.pricing);
  const [openingHours, setOpeningHours] = useState<OpeningHours>(
    gym.opening_hours || DAYS.reduce((acc, day) => ({
      ...acc,
      [day.key]: { open: '06:00', close: '22:00', closed: false },
    }), {})
  );

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: gym.name,
      description: gym.description || '',
      address: gym.address || '',
      instagram_handle: (gym as any).instagram_handle || '',
    },
  });


  const updateOpeningHoursField = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const result = await updateGym({
      name: data.name,
      description: data.description || null,
      address: data.address || null,
      instagram_handle: data.instagram_handle || null,
      latitude: location.lat,
      longitude: location.lng,
      opening_hours: openingHours,
       pricing: pricing,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsDrawerOpen(false);
    }
  };

  const handleCoverUpload = async (url: string) => {
    setCoverPhotoUrl(url);
    await updateGym({ cover_photo_url: url });
  };

  const handleLogoUpload = async (url: string) => {
    setLogoUrl(url);
    await updateGym({ logo_url: url });
  };

  const hours = gym.opening_hours as OpeningHours;

  // Create a local gym object with updated photo URLs for preview
  const previewGym: Gym = {
    ...gym,
    cover_photo_url: coverPhotoUrl,
    logo_url: logoUrl,
  };

  return (
    <div className="space-y-4">
      {/* Profile Preview */}
      <GymProfilePreview gym={previewGym} />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant={gym.is_published ? 'outline' : 'default'}
          className="flex-1"
          onClick={togglePublish}
        >
          {gym.is_published ? t('business.hide_from_map_btn') : t('business.publish_btn')}
        </Button>
        
        <Drawer open={isPhotoDrawerOpen} onOpenChange={setIsPhotoDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="icon">
              <Image className="w-4 h-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t('business.edit_photos')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="space-y-2">
                <Label>{t('business.cover_photo')}</Label>
                <GymImageUpload
                  type="cover"
                  currentUrl={coverPhotoUrl}
                  onUploadComplete={handleCoverUpload}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('business.gym_logo')}</Label>
                <div className="flex justify-center">
                  <GymImageUpload
                    type="logo"
                    currentUrl={logoUrl}
                    onUploadComplete={handleLogoUpload}
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* Gallery Section */}
              <GymPhotosManager gymId={gym.id} />
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="icon">
              <Pencil className="w-4 h-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>{t('business.edit_gym')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 overflow-y-auto">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('business.gym_name_field')}</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t('business.description')}</Label>
                    <Textarea id="description" {...register('description')} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">{t('business.address')}</Label>
                    <Input id="address" {...register('address')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instagram_handle">{t('business.instagram_label')}</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">@</span>
                      <Input id="instagram_handle" placeholder="nazev_posilovny" {...register('instagram_handle')} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('business.instagram_hint')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('business.map_location')}</Label>
                  <LocationPicker
                    latitude={location.lat}
                    longitude={location.lng}
                    onLocationChange={(lat, lng) => setLocation({ lat, lng })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>{t('business.opening_hours')}</Label>
                  {DAYS.map(day => (
                    <div key={day.key} className="flex flex-col gap-2 py-2 border-b border-border last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t(day.labelKey)}</span>
                        <Switch
                          checked={!openingHours[day.key]?.closed}
                          onCheckedChange={(checked) => updateOpeningHoursField(day.key, 'closed', !checked)}
                        />
                      </div>
                      {!openingHours[day.key]?.closed ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={openingHours[day.key]?.open || '06:00'}
                            onChange={(e) => updateOpeningHoursField(day.key, 'open', e.target.value)}
                            className="flex-1"
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={openingHours[day.key]?.close || '22:00'}
                            onChange={(e) => updateOpeningHoursField(day.key, 'close', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t('business.closed')}</span>
                      )}
                    </div>
                  ))}
                </div>

               <Separator className="my-4" />

               <div className="space-y-3">
                 <Label>{t('business.tab_pricing')}</Label>
                 <GymPricingEditor
                   pricing={pricing}
                   onChange={setPricing}
                   showSaveButton={false}
                 />
               </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('business.saving')}
                    </>
                  ) : (
                    t('business.save_changes')
                  )}
                </Button>
              </form>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
};

export default GymProfile;