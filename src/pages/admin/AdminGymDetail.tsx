import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2, Clock, Pencil, Image, ArrowLeft, Trash2, Plus,
  Search, Dumbbell, MapPin, Globe, Lock, Camera, ImageIcon, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import LocationPicker from '@/components/business/LocationPicker';
import GymPhotosManager from '@/components/business/GymPhotosManager';
import GymPricingDisplay from '@/components/business/GymPricingDisplay';
import GymPricingEditor from '@/components/business/GymPricingEditor';
import { GymPricing } from '@/contexts/GymContext';
import { Separator } from '@/components/ui/separator';

interface OpeningHours {
  [day: string]: { open: string; close: string; closed: boolean };
}

interface GymData {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
  cover_photo_url: string | null;
  opening_hours: OpeningHours;
  pricing: GymPricing | null;
}

interface GymMachine {
  id: string;
  gym_id: string;
  machine_id: string;
  quantity: number;
  max_weight_kg: number | null;
  machine?: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface Machine {
  id: string;
  name: string;
  description: string | null;
}

const formSchema = z.object({
  name: z.string().min(2, 'Název musí mít alespoň 2 znaky'),
  description: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const AdminGymDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [gym, setGym] = useState<GymData | null>(null);
  const [gymMachines, setGymMachines] = useState<GymMachine[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ownerName, setOwnerName] = useState<string>('');
  
  // Drawers
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isPhotoDrawerOpen, setIsPhotoDrawerOpen] = useState(false);
  const [isAddMachineDrawerOpen, setIsAddMachineDrawerOpen] = useState(false);
  const [isEditMachineDrawerOpen, setIsEditMachineDrawerOpen] = useState(false);
  
  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState({ lat: 49.8, lng: 15.5 });
  const [openingHours, setOpeningHours] = useState<OpeningHours>({});
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pricing, setPricing] = useState<GymPricing | null>(null);
  
  // Machine states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedGymMachine, setSelectedGymMachine] = useState<GymMachine | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [maxWeight, setMaxWeight] = useState<string>('');
  const [deleteMachineId, setDeleteMachineId] = useState<string | null>(null);
  const [deleteGymDialog, setDeleteGymDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Image upload refs
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // Fetch gym data
  useEffect(() => {
    const fetchGym = async () => {
      if (!id) return;
      
      setIsLoading(true);
      
      const { data: gymData, error: gymError } = await supabase
        .from('gyms')
        .select('*')
        .eq('id', id)
        .single();

      if (gymError || !gymData) {
        console.error('Error fetching gym:', gymError);
        toast.error(t('admin.gym_not_found_error'));
        navigate('/admin/gyms');
        return;
      }

      const typedGym = {
        ...gymData,
        opening_hours: gymData.opening_hours as OpeningHours,
        pricing: gymData.pricing as unknown as GymPricing | null
      };
      
      setGym(typedGym);
      setLocation({ lat: typedGym.latitude, lng: typedGym.longitude });
      setOpeningHours(typedGym.opening_hours || {});
      setCoverPhotoUrl(typedGym.cover_photo_url);
      setLogoUrl(typedGym.logo_url);
      setPricing(typedGym.pricing);
      reset({
        name: typedGym.name,
        description: typedGym.description || '',
        address: typedGym.address || '',
      });

      // Fetch owner name
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', typedGym.owner_id)
        .single();

      if (profileData) {
        setOwnerName(`${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || t('admin.no_name'));
      }

      // Fetch machines
      const { data: machinesData } = await supabase
        .from('gym_machines')
        .select(`*, machine:machines(id, name, description)`)
        .eq('gym_id', id);

      setGymMachines(machinesData as GymMachine[] || []);

      // Fetch all machines for selection
      const { data: allMachinesData } = await supabase
        .from('machines')
        .select('id, name, description')
        .order('name');

      setAllMachines(allMachinesData || []);
      setIsLoading(false);
    };

    fetchGym();
  }, [id, navigate, reset]);

  const updateOpeningHoursField = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const onSubmit = async (data: FormData) => {
    if (!gym) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from('gyms')
      .update({
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        latitude: location.lat,
        longitude: location.lng,
        opening_hours: openingHours,
        pricing: pricing as unknown as null,
      })
      .eq('id', gym.id);

    setIsSubmitting(false);
    
    if (error) {
      toast.error(t('admin.save_error'));
      return;
    }

    toast.success(t('admin.gym_updated'));
    setGym(prev => prev ? { ...prev, ...data, latitude: location.lat, longitude: location.lng, opening_hours: openingHours, pricing: pricing } : null);
    setIsEditDrawerOpen(false);
  };

  const togglePublish = async () => {
    if (!gym) return;
    
    const { error } = await supabase
      .from('gyms')
      .update({ is_published: !gym.is_published })
      .eq('id', gym.id);

    if (error) {
      toast.error(t('admin.toggle_error'));
      return;
    }

    setGym(prev => prev ? { ...prev, is_published: !prev.is_published } : null);
    toast.success(gym.is_published ? t('admin.gym_now_private') : t('admin.gym_published'));
  };

  const handleDeleteGym = async () => {
    if (!gym) return;
    
    setIsDeleting(true);
    const { error } = await supabase
      .from('gyms')
      .delete()
      .eq('id', gym.id);

    if (error) {
      toast.error(t('admin.delete_gym_error'));
      setIsDeleting(false);
      return;
    }

    toast.success(t('admin.gym_deleted'));
    navigate('/admin/gyms');
  };

  // Image upload handlers
  const handleImageUpload = async (file: File, type: 'cover' | 'logo') => {
    if (!gym) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error(t('admin.image_type_error'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.image_size_error'));
      return;
    }

    if (type === 'cover') { setIsUploadingCover(true); } else { setIsUploadingLogo(true); }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${gym.owner_id}/${type}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('gym-images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error(t('admin.image_upload_error'));
      if (type === 'cover') { setIsUploadingCover(false); } else { setIsUploadingLogo(false); }
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gym-images')
      .getPublicUrl(fileName);

    const updateField = type === 'cover' ? 'cover_photo_url' : 'logo_url';
    await supabase.from('gyms').update({ [updateField]: publicUrl }).eq('id', gym.id);

    if (type === 'cover') {
      setCoverPhotoUrl(publicUrl);
      setIsUploadingCover(false);
    } else {
      setLogoUrl(publicUrl);
      setIsUploadingLogo(false);
    }
    
    toast.success(t('admin.image_uploaded'));
  };

  // Machine handlers
  const filteredMachines = allMachines.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !gymMachines.some(gm => gm.machine_id === m.id)
  );

  const handleAddMachine = async () => {
    if (!selectedMachine || !gym) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from('gym_machines')
      .insert({
        gym_id: gym.id,
        machine_id: selectedMachine.id,
        quantity,
        max_weight_kg: maxWeight ? parseFloat(maxWeight) : null,
      });

    setIsSubmitting(false);
    
    if (error) {
      if (error.code === '23505') {
        toast.error(t('admin.machine_exists_error'));
      } else {
        toast.error(t('admin.add_machine_error'));
      }
      return;
    }

    // Refresh machines
    const { data: machinesData } = await supabase
      .from('gym_machines')
      .select(`*, machine:machines(id, name, description)`)
      .eq('gym_id', gym.id);

    setGymMachines(machinesData as GymMachine[] || []);
    setIsAddMachineDrawerOpen(false);
    setSelectedMachine(null);
    setQuantity(1);
    setMaxWeight('');
    toast.success(t('admin.machine_added'));
  };

  const handleEditMachine = async () => {
    if (!selectedGymMachine) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from('gym_machines')
      .update({
        quantity,
        max_weight_kg: maxWeight ? parseFloat(maxWeight) : null,
      })
      .eq('id', selectedGymMachine.id);

    setIsSubmitting(false);
    
    if (error) {
      toast.error(t('admin.edit_machine_error'));
      return;
    }

    // Refresh machines
    const { data: machinesData } = await supabase
      .from('gym_machines')
      .select(`*, machine:machines(id, name, description)`)
      .eq('gym_id', gym!.id);

    setGymMachines(machinesData as GymMachine[] || []);
    setIsEditMachineDrawerOpen(false);
    setSelectedGymMachine(null);
    toast.success(t('admin.machine_updated'));
  };

  const handleDeleteMachine = async () => {
    if (!deleteMachineId) return;
    
    await supabase.from('gym_machines').delete().eq('id', deleteMachineId);
    setGymMachines(prev => prev.filter(m => m.id !== deleteMachineId));
    setDeleteMachineId(null);
    toast.success(t('admin.machine_removed'));
  };

  const openEditMachineDrawer = (gm: GymMachine) => {
    setSelectedGymMachine(gm);
    setQuantity(gm.quantity);
    setMaxWeight(gm.max_weight_kg?.toString() || '');
    setIsEditMachineDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!gym) return null;

  return (
    <AdminLayout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/gyms')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{gym.name}</h2>
            <p className="text-sm text-muted-foreground">{t('admin.gym_owner')} {ownerName}</p>
          </div>
          <Badge variant={gym.is_published ? 'default' : 'secondary'}>
            {gym.is_published ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
            {gym.is_published ? t('admin.gym_public') : t('admin.gym_private')}
          </Badge>
        </div>

        {/* Cover Photo & Logo */}
        <div className="relative">
          {coverPhotoUrl ? (
            <img src={coverPhotoUrl} alt={gym.name} className="w-full h-40 object-cover rounded-xl" />
          ) : (
            <div className="w-full h-40 bg-muted rounded-xl flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute -bottom-6 left-4">
            <div className="w-16 h-16 rounded-full bg-background border-4 border-background overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Camera className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant={gym.is_published ? 'outline' : 'default'}
            className="flex-1"
            onClick={togglePublish}
          >
            {gym.is_published ? t('admin.gym_hide') : t('admin.gym_publish')}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsPhotoDrawerOpen(true)}>
            <Image className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsEditDrawerOpen(true)}>
            <Pencil className="w-4 h-4" />
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid gap-3">
          {gym.address && (
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{gym.address}</span>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t('admin.opening_hours')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 text-sm">
                {DAY_KEYS.map(key => (
                  <div key={key} className="flex justify-between py-1">
                    <span className="font-medium">{t(`admin.day_${key}`)}</span>
                    <span className="text-muted-foreground">
                      {gym.opening_hours[key]?.closed
                        ? t('admin.closed')
                        : `${gym.opening_hours[key]?.open || '-'} - ${gym.opening_hours[key]?.close || '-'}`
                      }
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {t('admin.pricing')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GymPricingDisplay pricing={gym.pricing} />
          </CardContent>
        </Card>

        {/* Machines Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Dumbbell className="w-4 h-4" />
                {t('admin.machines_count', { n: gymMachines.length })}
              </CardTitle>
              <Button size="sm" onClick={() => setIsAddMachineDrawerOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                {t('admin.add')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {gymMachines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('admin.no_machines')}
              </p>
            ) : (
              <div className="space-y-2">
                {gymMachines.map((gm) => (
                  <div key={gm.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{gm.machine?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{gm.quantity}x</Badge>
                        {gm.max_weight_kg && (
                          <Badge variant="outline" className="text-xs">max {gm.max_weight_kg} kg</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMachineDrawer(gm)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteMachineId(gm.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">{t('admin.danger_zone')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={() => setDeleteGymDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('admin.delete_gym')}
            </Button>
          </CardContent>
        </Card>

        {/* Edit Profile Drawer */}
        <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>{t('admin.edit_gym_title')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 overflow-y-auto max-h-[75vh]">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('admin.gym_name_label')}</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t('admin.description_label')}</Label>
                    <Textarea id="description" {...register('description')} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">{t('admin.address_label')}</Label>
                    <Input id="address" {...register('address')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('admin.map_location_label')}</Label>
                  <LocationPicker
                    latitude={location.lat}
                    longitude={location.lng}
                    onLocationChange={(lat, lng) => setLocation({ lat, lng })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>{t('admin.opening_hours')}</Label>
                  {DAY_KEYS.map(key => (
                    <div key={key} className="flex flex-col gap-2 py-2 border-b border-border last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t(`admin.day_${key}`)}</span>
                        <Switch
                          checked={!openingHours[key]?.closed}
                          onCheckedChange={(checked) => updateOpeningHoursField(key, 'closed', !checked)}
                        />
                      </div>
                      {!openingHours[key]?.closed ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={openingHours[key]?.open || '06:00'}
                            onChange={(e) => updateOpeningHoursField(key, 'open', e.target.value)}
                            className="flex-1"
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={openingHours[key]?.close || '22:00'}
                            onChange={(e) => updateOpeningHoursField(key, 'close', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t('admin.closed')}</span>
                      )}
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <Label>Ceník</Label>
                  <GymPricingEditor 
                    pricing={pricing} 
                    onChange={setPricing} 
                    showSaveButton={false} 
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('admin.saving')}</> : t('admin.save_changes')}
                </Button>
              </form>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Photo Drawer */}
        <Drawer open={isPhotoDrawerOpen} onOpenChange={setIsPhotoDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t('admin.edit_photos_title')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="space-y-2">
                <Label>{t('admin.cover_photo_label')}</Label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'cover')}
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center bg-muted/50 overflow-hidden"
                >
                  {isUploadingCover ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : coverPhotoUrl ? (
                    <img src={coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">{t('admin.add_cover_photo')}</span>
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.gym_logo_label')}</Label>
                <div className="flex justify-center">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors flex items-center justify-center bg-muted/50 overflow-hidden"
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
              
              <Separator />
              
              {/* Gallery Section */}
              <GymPhotosManager gymId={gym.id} />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Add Machine Drawer */}
        <Drawer open={isAddMachineDrawerOpen} onOpenChange={setIsAddMachineDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>{t('admin.add_machine_title')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 overflow-y-auto space-y-4">
              {!selectedMachine ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.search_machine_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {filteredMachines.map((machine) => (
                      <Card 
                        key={machine.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedMachine(machine)}
                      >
                        <CardContent className="py-3 px-4">
                          <h4 className="font-medium">{machine.name}</h4>
                          {machine.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {machine.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {filteredMachines.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">{t('admin.no_machines_found')}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setSelectedMachine(null)} className="mb-2">
                    {t('admin.select_other_machine')}
                  </Button>
                  <Card>
                    <CardContent className="py-3 px-4">
                      <h4 className="font-medium">{selectedMachine.name}</h4>
                      {selectedMachine.description && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedMachine.description}</p>
                      )}
                    </CardContent>
                  </Card>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>{t('admin.quantity_label')}</Label>
                      <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('admin.max_weight_label')}</Label>
                      <Input type="number" placeholder={t('admin.optional')} value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} />
                    </div>
                    <Button className="w-full" onClick={handleAddMachine} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('admin.adding')}</> : t('admin.add_machine_btn')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Edit Machine Drawer */}
        <Drawer open={isEditMachineDrawerOpen} onOpenChange={setIsEditMachineDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t('admin.edit_machine_title')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 space-y-4">
              {selectedGymMachine && (
                <>
                  <Card>
                    <CardContent className="py-3 px-4">
                      <h4 className="font-medium">{selectedGymMachine.machine?.name}</h4>
                    </CardContent>
                  </Card>
                  <div className="space-y-2">
                    <Label>{t('admin.quantity_label')}</Label>
                    <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('admin.max_weight_label')}</Label>
                    <Input type="number" placeholder={t('admin.optional')} value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleEditMachine} disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('admin.saving_machine')}</> : t('admin.save_changes')}
                  </Button>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Delete Machine Confirmation */}
        <AlertDialog open={!!deleteMachineId} onOpenChange={() => setDeleteMachineId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.remove_machine_title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.remove_machine_desc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMachine}>{t('admin.remove')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Gym Confirmation */}
        <AlertDialog open={deleteGymDialog} onOpenChange={setDeleteGymDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.delete_gym_title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.delete_gym_desc', { name: gym.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteGym}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminGymDetail;
