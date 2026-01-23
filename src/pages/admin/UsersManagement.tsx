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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { KeyRound, Pencil, Loader2, Search, ChevronRight, Plus, Eye, EyeOff, Mail, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';
import MobileCard from '@/components/admin/MobileCard';
import AdminPagination from '@/components/admin/AdminPagination';

interface UserData {
  id: string;
  user_id: string;
  email?: string;
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
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | 'change-email' | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', age: '', role: 'user', gym_license_count: '0' });
  const [currentPage, setCurrentPage] = useState(1);
  const [createForm, setCreateForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'user', gym_license_count: '1' });
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  
  // Password reset dialog
  const [resetPasswordDialog, setResetPasswordDialog] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  
  // Delete user dialog
  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    const response = await supabase.functions.invoke('admin-user-actions', {
      body: { action: 'list_users', page: 1, per_page: 1000 },
    });

    if (response.error) {
      console.error('Error fetching users:', response.error);
      toast.error('Nepodarilo sa načítať užívateľov');
      setIsLoading(false);
      return;
    }

    if (response.data?.error) {
      console.error('Error:', response.data.error);
      toast.error(response.data.error);
      setIsLoading(false);
      return;
    }

    setUsers(response.data?.users || []);
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
      const email = (user.email || '').toLowerCase();
      return fullName.includes(searchLower) || user.user_id.includes(searchLower) || email.includes(searchLower);
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

  const handleResetPassword = async (user: UserData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setGeneratedPassword('');
    setPasswordCopied(false);
    setResetPasswordDialog(true);
  };

  const confirmResetPassword = async () => {
    if (!selectedUser) return;
    
    setIsResettingPassword(true);
    
    const response = await supabase.functions.invoke('admin-user-actions', {
      body: { action: 'reset_password', user_id: selectedUser.user_id },
    });

    setIsResettingPassword(false);

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || 'Nepodarilo sa resetovať heslo');
      return;
    }

    setGeneratedPassword(response.data.new_password);
    toast.success('Heslo bolo resetované');
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setPasswordCopied(true);
    toast.success('Heslo skopírované do schránky');
  };

  const handleChangeEmail = (user: UserData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setNewEmail(user.email || '');
    setDrawerMode('change-email');
  };

  const handleDeleteUser = (user: UserData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setDeleteUserDialog(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    
    setIsDeletingUser(true);
    
    const response = await supabase.functions.invoke('admin-user-actions', {
      body: { action: 'delete_user', user_id: selectedUser.user_id },
    });

    setIsDeletingUser(false);

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || 'Nepodarilo sa odstrániť používateľa');
      return;
    }

    toast.success('Používateľ bol odstránený');
    setDeleteUserDialog(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const confirmChangeEmail = async () => {
    if (!selectedUser || !newEmail) return;
    
    if (newEmail === selectedUser.email) {
      toast.error('Nový email je rovnaký ako súčasný');
      return;
    }

    setIsChangingEmail(true);
    
    const response = await supabase.functions.invoke('admin-user-actions', {
      body: { action: 'change_email', user_id: selectedUser.user_id, new_email: newEmail },
    });

    setIsChangingEmail(false);

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || 'Nepodarilo sa zmeniť email');
      return;
    }

    toast.success('Email bol úspešne zmenený');
    closeDrawer();
    fetchUsers();
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
    setCreateForm({ email: '', password: '', first_name: '', last_name: '', role: 'user', gym_license_count: '1' });
    setShowPassword(false);
    setNewEmail('');
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      toast.error('Email a heslo sú povinné');
      return;
    }

    if (createForm.password.length < 6) {
      toast.error('Heslo musí mať aspoň 6 znakov');
      return;
    }

    setIsCreating(true);
    
    const response = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: createForm.email,
        password: createForm.password,
        first_name: createForm.first_name || null,
        last_name: createForm.last_name || null,
        role: createForm.role,
        gym_license_count: createForm.role === 'business' ? parseInt(createForm.gym_license_count) : 0,
      },
    });

    setIsCreating(false);

    if (response.error) {
      toast.error(response.error.message || 'Nepodarilo sa vytvoriť používateľa');
      return;
    }

    if (response.data?.error) {
      toast.error(response.data.error);
      return;
    }

    toast.success('Používateľ bol vytvorený');
    closeDrawer();
    fetchUsers();
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
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Používatelia</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{users.length} celkom</span>
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
            placeholder="Hľadať podľa mena alebo emailu..."
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
                    <p className="text-sm text-muted-foreground truncate">{user.email || '-'}</p>
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
                      title="Upraviť"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleChangeEmail(user, e)}
                      title="Zmeniť email"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => handleResetPassword(user, e)}
                      title="Reset hesla"
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteUser(user, e)}
                      title="Odstrániť"
                    >
                      <Trash2 className="w-4 h-4" />
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
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium">{selectedUser.email || '-'}</p>
                </div>
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

        {/* Change Email Drawer */}
        <Drawer open={drawerMode === 'change-email'} onOpenChange={closeDrawer}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Zmeniť email</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Aktuálny email</Label>
                <p className="font-medium">{selectedUser?.email || '-'}</p>
              </div>
              <div>
                <Label>Nový email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="novy@email.com"
                />
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={confirmChangeEmail} className="w-full" disabled={isChangingEmail || !newEmail}>
                {isChangingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Zmeniť email
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Zrušiť</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Create User Drawer */}
        <Drawer open={drawerMode === 'create'} onOpenChange={closeDrawer}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Nový používateľ</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>Heslo *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min. 6 znakov"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Meno</Label>
                <Input
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Priezvisko</Label>
                <Input
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Rola</Label>
                <Select value={createForm.role} onValueChange={(value) => setCreateForm({ ...createForm, role: value })}>
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
              {createForm.role === 'business' && (
                <div>
                  <Label>Počet licencií na posilovne</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={createForm.gym_license_count}
                    onChange={(e) => setCreateForm({ ...createForm, gym_license_count: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DrawerFooter>
              <Button onClick={handleCreateUser} className="w-full" disabled={isCreating}>
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Vytvoriť používateľa
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Zrušiť</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Password Reset Dialog */}
        <Dialog open={resetPasswordDialog} onOpenChange={(open) => {
          setResetPasswordDialog(open);
          if (!open) {
            setGeneratedPassword('');
            setPasswordCopied(false);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset hesla</DialogTitle>
              <DialogDescription>
                {generatedPassword 
                  ? 'Nové heslo bolo vygenerované. Skopírujte ho a pošlite užívateľovi.'
                  : `Naozaj chcete resetovať heslo pre ${selectedUser?.email || 'tohto užívateľa'}?`
                }
              </DialogDescription>
            </DialogHeader>
            
            {generatedPassword ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="flex-1 font-mono text-lg">{generatedPassword}</code>
                  <Button size="icon" variant="ghost" onClick={copyPassword}>
                    {passwordCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Toto heslo sa zobrazí iba raz. Uistite sa, že ste ho skopírovali.
                </p>
              </div>
            ) : null}
            
            <DialogFooter>
              {generatedPassword ? (
                <Button onClick={() => setResetPasswordDialog(false)}>Zavrieť</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setResetPasswordDialog(false)}>
                    Zrušiť
                  </Button>
                  <Button onClick={confirmResetPassword} disabled={isResettingPassword}>
                    {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Resetovať heslo
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={deleteUserDialog} onOpenChange={(open) => {
          setDeleteUserDialog(open);
          if (!open) setSelectedUser(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Odstrániť používateľa</DialogTitle>
              <DialogDescription>
                Naozaj chcete odstrániť používateľa <strong>{selectedUser?.email}</strong>? 
                Táto akcia je nevratná a odstráni všetky údaje spojené s týmto účtom.
              </DialogDescription>
            </DialogHeader>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteUserDialog(false)}>
                Zrušiť
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteUser} 
                disabled={isDeletingUser}
              >
                {isDeletingUser ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Odstrániť
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default UsersManagement;
