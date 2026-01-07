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
import { Badge } from '@/components/ui/badge';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerTrigger 
} from '@/components/ui/drawer';
import { Loader2, MapPin, Clock, Eye, EyeOff, Pencil } from 'lucide-react';
import LocationPicker from './LocationPicker';
import { useGym, Gym, OpeningHours } from '@/hooks/useGym';

const formSchema = z.object({
  name: z.string().min(2, 'Název musí mít alespoň 2 znaky'),
  description: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const DAYS = [
  { key: 'monday', label: 'Po' },
  { key: 'tuesday', label: 'Út' },
  { key: 'wednesday', label: 'St' },
  { key: 'thursday', label: 'Čt' },
  { key: 'friday', label: 'Pá' },
  { key: 'saturday', label: 'So' },
  { key: 'sunday', label: 'Ne' },
];

interface GymProfileProps {
  gym: Gym;
}

const GymProfile = ({ gym }: GymProfileProps) => {
  const { updateGym, togglePublish } = useGym();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [location, setLocation] = useState({ lat: gym.latitude, lng: gym.longitude });
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
      latitude: location.lat,
      longitude: location.lng,
      opening_hours: openingHours,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsDrawerOpen(false);
    }
  };

  const hours = gym.opening_hours as OpeningHours;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{gym.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={gym.is_published ? 'default' : 'secondary'}>
                    {gym.is_published ? 'Veřejná' : 'Soukromá'}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              variant={gym.is_published ? 'outline' : 'default'}
              size="sm"
              onClick={togglePublish}
              className="gap-2"
            >
              {gym.is_published ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Skrýt
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Zveřejnit
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Informácie</CardTitle>
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon">
                <Pencil className="w-4 h-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
              <DrawerHeader>
                <DrawerTitle>Upravit posilovnu</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-8 overflow-y-auto">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Název posilovny</Label>
                      <Input id="name" {...register('name')} />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Popis</Label>
                      <Textarea id="description" {...register('description')} rows={3} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Adresa</Label>
                      <Input id="address" {...register('address')} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Lokace na mapě</Label>
                    <LocationPicker
                      latitude={location.lat}
                      longitude={location.lng}
                      onLocationChange={(lat, lng) => setLocation({ lat, lng })}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Otevírací hodiny</Label>
                    {DAYS.map(day => (
                      <div key={day.key} className="flex flex-col gap-2 py-2 border-b border-border last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{day.label}</span>
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
                          <span className="text-sm text-muted-foreground">Zavřeno</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ukládám...
                      </>
                    ) : (
                      'Uložit změny'
                    )}
                  </Button>
                </form>
              </div>
            </DrawerContent>
          </Drawer>
        </CardHeader>
        <CardContent className="space-y-3">
          {gym.description && (
            <p className="text-sm text-muted-foreground">{gym.description}</p>
          )}
          {gym.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {gym.address}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opening Hours Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Otevírací hodiny
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-sm">
            {DAYS.map(day => (
              <div key={day.key} className="flex justify-between py-1">
                <span className="font-medium">{day.label}</span>
                <span className="text-muted-foreground">
                  {hours[day.key]?.closed 
                    ? 'Zavřeno' 
                    : `${hours[day.key]?.open || '-'} - ${hours[day.key]?.close || '-'}`
                  }
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GymProfile;
