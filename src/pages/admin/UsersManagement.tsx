import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KeyRound, Pencil, Loader2, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import MobileCard from '@/components/admin/MobileCard';
import AdminPagination from '@/components/admin/AdminPagination';

interface UserData {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  gender: string | null;
  onboarding_completed: boolean;
  created_at: string;
  role?: string;
  gym_license_count: number;
}

const ITEMS_PER_PAGE = 100;

const UsersManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', age: '', role: 'user', gym_license_count: '0' });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setIsLoading(false);
      return;
    }

    const usersWithRoles = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.user_id)
          .single();

        return {
          ...profile,
          role: roleData?.role || 'user',
        };
      })
    );

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchLower = searchTerm.toLowerCase();
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
      return fullName.includes(searchLower) || user.user_id.includes(searchLower);
    });
  }, [users, searchTerm]);

  // Paginate filtered results
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleViewUser = (user: UserData) => {
    setSelectedUser(user);
    setDrawerMode('view');
  };

  const handleEditUser = (user: UserData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      age: user.age?.toString() || '',
      role: user.role || 'user',
      gym_license_count: user.gym_license_count?.toString() || '0',
    });
    setDrawerMode('edit');
  };

  const handleSendPasswordReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Funkcia reset hesla vyžaduje nastavenie edge function');
  };

  const saveUserEdit = async () => {
    if (!selectedUser) return;

    // Update profile (including gym_license_count for business users)
    const profileUpdate: Record<string, unknown> = {
      first_name: editForm.first_name || null,
      last_name: editForm.last_name || null,
      age: editForm.age ? parseInt(editForm.age) : null,
    };

    // Only set gym_license_count if role is business
    if (editForm.role === 'business') {
      profileUpdate.gym_license_count = editForm.gym_license_count ? parseInt(editForm.gym_license_count) : 1;
    } else {
      profileUpdate.gym_license_count = 0;
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update(profileUpdate)
      .eq('user_id', selectedUser.user_id);

    if (profileError) {
      toast.error('Chyba pri ukladaní profilu');
      return;
    }

    // Update role if changed
    if (editForm.role !== selectedUser.role) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: editForm.role as 'user' | 'business' | 'admin' })
        .eq('user_id', selectedUser.user_id);

      if (roleError) {
        toast.error('Chyba pri zmene role');
        return;
      }
    }

    toast.success('Používateľ aktualizovaný');
    setDrawerMode(null);
    fetchUsers();
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedUser(null);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive';
      case 'business':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Používatelia</h2>
          <span className="text-sm text-muted-foreground">{users.length} celkom</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať používateľa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Mobile Card List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedUsers.map((user) => (
              <MobileCard key={user.id} onClick={() => handleViewUser(user)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : 'Bez mena'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role || 'user')}`}>
                        {user.role}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        user.onboarding_completed 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-orange-500/10 text-orange-600'
                      }`}>
                        {user.onboarding_completed ? 'Onboarded' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleEditUser(user, e)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleSendPasswordReset}
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-1" />
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        )}

        {/* Pagination */}
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredUsers.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />

        {/* View Drawer */}
        <Drawer open={drawerMode === 'view'} onOpenChange={closeDrawer}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Detail používateľa</DrawerTitle>
            </DrawerHeader>
            {selectedUser && (
              <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Meno</Label>
                    <p className="font-medium">{selectedUser.first_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Priezvisko</Label>
                    <p className="font-medium">{selectedUser.last_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Vek</Label>
                    <p className="font-medium">{selectedUser.age || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Pohlavie</Label>
                    <p className="font-medium">{selectedUser.gender || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Rola</Label>
                    <p className="font-medium">{selectedUser.role}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Registrácia</Label>
                    <p className="font-medium">
                      {new Date(selectedUser.created_at).toLocaleDateString('sk-SK')}
                    </p>
                  </div>
                  {selectedUser.role === 'business' && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Licencia posilovní</Label>
                      <p className="font-medium">{selectedUser.gym_license_count || 0}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">User ID</Label>
                  <p className="font-mono text-sm break-all">{selectedUser.user_id}</p>
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

        {/* Edit Drawer */}
        <Drawer open={drawerMode === 'edit'} onOpenChange={closeDrawer}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Upraviť používateľa</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <Label>Meno</Label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Priezvisko</Label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Vek</Label>
                <Input
                  type="number"
                  value={editForm.age}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                />
              </div>
              <div>
                <Label>Rola</Label>
                <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value, gym_license_count: value === 'business' ? (editForm.gym_license_count || '1') : '0' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.role === 'business' && (
                <div>
                  <Label>Počet licencií na posilovne</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={editForm.gym_license_count}
                    onChange={(e) => setEditForm({ ...editForm, gym_license_count: e.target.value })}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Koľko posilovní môže tento používateľ vytvoriť
                  </p>
                </div>
              )}
            </div>
            <DrawerFooter>
              <Button onClick={saveUserEdit} className="w-full">Uložiť</Button>
              <DrawerClose asChild>
                <Button variant="outline">Zrušiť</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
};

export default UsersManagement;
