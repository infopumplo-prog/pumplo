import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
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
import { Pencil, Loader2, Search, ChevronRight, Plus, Trash2, Building2, MapPin, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import MobileCard from '@/components/admin/MobileCard';
import AdminPagination from '@/components/admin/AdminPagination';
import AdminCreateGymForm from '@/components/admin/AdminCreateGymForm';

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
  opening_hours: Record<string, { open: string; close: string; closed: boolean }>;
  owner_name?: string;
}

const ITEMS_PER_PAGE = 100;

const GymsManagement = () => {
  const [gyms, setGyms] = useState<GymData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGym, setSelectedGym] = useState<GymData | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteGym, setDeleteGym] = useState<GymData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGyms = async () => {
    setIsLoading(true);
    
    const { data: gymsData, error: gymsError } = await supabase
      .from('gyms')
      .select('*')
      .order('created_at', { ascending: false });

    if (gymsError) {
      console.error('Error fetching gyms:', gymsError);
      setIsLoading(false);
      return;
    }

    // Fetch owner names for each gym
    const gymsWithOwners = await Promise.all(
      (gymsData || []).map(async (gym) => {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('user_id', gym.owner_id)
          .single();

        return {
          ...gym,
          opening_hours: gym.opening_hours as Record<string, { open: string; close: string; closed: boolean }>,
          owner_name: profileData 
            ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Bez mena'
            : 'Neznámy'
        };
      })
    );

    setGyms(gymsWithOwners);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const filteredGyms = useMemo(() => {
    return gyms.filter((gym) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        gym.name.toLowerCase().includes(searchLower) ||
        (gym.address || '').toLowerCase().includes(searchLower) ||
        (gym.owner_name || '').toLowerCase().includes(searchLower)
      );
    });
  }, [gyms, searchTerm]);

  const totalPages = Math.ceil(filteredGyms.length / ITEMS_PER_PAGE);
  const paginatedGyms = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGyms.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGyms, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleViewGym = (gym: GymData) => {
    setSelectedGym(gym);
    setDrawerMode('view');
  };

  const handleEditGym = (gym: GymData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGym(gym);
    setDrawerMode('edit');
  };

  const handleDeleteGym = (gym: GymData, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteGym(gym);
  };

  const confirmDelete = async () => {
    if (!deleteGym) return;

    setIsDeleting(true);
    const { error } = await supabase
      .from('gyms')
      .delete()
      .eq('id', deleteGym.id);

    if (error) {
      toast.error('Nepodarilo sa zmazať posilovňu');
      console.error('Delete error:', error);
    } else {
      toast.success('Posilovňa bola zmazaná');
      fetchGyms();
    }
    setIsDeleting(false);
    setDeleteGym(null);
  };

  const togglePublish = async (gym: GymData, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from('gyms')
      .update({ is_published: !gym.is_published })
      .eq('id', gym.id);

    if (error) {
      toast.error('Nepodarilo sa zmeniť stav zverejnenia');
    } else {
      toast.success(gym.is_published ? 'Posilovňa je teraz súkromná' : 'Posilovňa bola zverejnená');
      fetchGyms();
    }
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedGym(null);
  };

  const handleCreateSuccess = () => {
    fetchGyms();
    setDrawerMode(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Posilovne</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{gyms.length} celkom</span>
            <Button size="sm" onClick={() => setDrawerMode('create')}>
              <Plus className="w-4 h-4 mr-1" />
              Pridať
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať posilovňu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Gym List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedGyms.map((gym) => (
              <MobileCard key={gym.id} onClick={() => handleViewGym(gym)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {gym.logo_url ? (
                        <img src={gym.logo_url} alt={gym.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Building2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{gym.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={gym.is_published ? 'default' : 'secondary'} className="text-xs">
                          {gym.is_published ? (
                            <><Globe className="w-3 h-3 mr-1" /> Verejná</>
                          ) : (
                            <><Lock className="w-3 h-3 mr-1" /> Súkromná</>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {gym.owner_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => togglePublish(gym, e)}
                    >
                      {gym.is_published ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Globe className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleEditGym(gym, e)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteGym(gym, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-1" />
                  </div>
                </div>
              </MobileCard>
            ))}

            {paginatedGyms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Žiadne posilovne
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredGyms.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />

        {/* View Drawer */}
        <Drawer open={drawerMode === 'view'} onOpenChange={closeDrawer}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Detail posilovne</DrawerTitle>
            </DrawerHeader>
            {selectedGym && (
              <div className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {selectedGym.cover_photo_url && (
                  <img 
                    src={selectedGym.cover_photo_url} 
                    alt={selectedGym.name}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Názov</Label>
                    <p className="font-medium">{selectedGym.name}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Popis</Label>
                    <p className="font-medium">{selectedGym.description || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Adresa</Label>
                    <p className="font-medium">{selectedGym.address || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Majiteľ</Label>
                    <p className="font-medium">{selectedGym.owner_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Stav</Label>
                    <Badge variant={selectedGym.is_published ? 'default' : 'secondary'}>
                      {selectedGym.is_published ? 'Verejná' : 'Súkromná'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Vytvorené</Label>
                    <p className="font-medium">
                      {new Date(selectedGym.created_at).toLocaleDateString('sk-SK')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Lokácia</Label>
                    <p className="font-medium text-sm">
                      {selectedGym.latitude.toFixed(4)}, {selectedGym.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Zavrieť</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Create Drawer */}
        <Drawer open={drawerMode === 'create'} onOpenChange={closeDrawer}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Nová posilovňa</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 overflow-y-auto max-h-[70vh]">
              <AdminCreateGymForm onSuccess={handleCreateSuccess} onCancel={closeDrawer} />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Edit Drawer - simplified, just toggle publish for now */}
        <Drawer open={drawerMode === 'edit'} onOpenChange={closeDrawer}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Upraviť posilovňu</DrawerTitle>
            </DrawerHeader>
            {selectedGym && (
              <div className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Zverejnená</p>
                    <p className="text-sm text-muted-foreground">
                      Posilovňa bude viditeľná na mape
                    </p>
                  </div>
                  <Switch
                    checked={selectedGym.is_published}
                    onCheckedChange={async (checked) => {
                      const { error } = await supabase
                        .from('gyms')
                        .update({ is_published: checked })
                        .eq('id', selectedGym.id);
                      
                      if (!error) {
                        toast.success(checked ? 'Posilovňa zverejnená' : 'Posilovňa skrytá');
                        fetchGyms();
                        closeDrawer();
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Zavrieť</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteGym} onOpenChange={() => setDeleteGym(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zmazať posilovňu?</AlertDialogTitle>
              <AlertDialogDescription>
                Táto akcia je nevratná. Posilovňa <strong>{deleteGym?.name}</strong> bude 
                natrvalo zmazaná spolu so všetkými strojmi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zmazať'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default GymsManagement;
