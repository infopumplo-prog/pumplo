import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, KeyRound, Pencil, Shield, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from './AdminLayout';

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
  email?: string;
}

const UsersManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'role' | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', age: '' });
  const [selectedRole, setSelectedRole] = useState<string>('user');

  const fetchUsers = async () => {
    setIsLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setIsLoading(false);
      return;
    }

    // Fetch roles for each user
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

  const handleViewUser = (user: UserData) => {
    setSelectedUser(user);
    setDialogMode('view');
  };

  const handleEditUser = (user: UserData) => {
    setSelectedUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      age: user.age?.toString() || '',
    });
    setDialogMode('edit');
  };

  const handleChangeRole = (user: UserData) => {
    setSelectedUser(user);
    setSelectedRole(user.role || 'user');
    setDialogMode('role');
  };

  const handleSendPasswordReset = async (user: UserData) => {
    // Note: This would require admin API access or edge function
    toast.info('Funkcia reset hesla vyžaduje nastavenie edge function');
  };

  const saveUserEdit = async () => {
    if (!selectedUser) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        age: editForm.age ? parseInt(editForm.age) : null,
      })
      .eq('user_id', selectedUser.user_id);

    if (error) {
      toast.error('Chyba pri ukladaní');
      return;
    }

    toast.success('Používateľ aktualizovaný');
    setDialogMode(null);
    fetchUsers();
  };

  const saveRoleChange = async () => {
    if (!selectedUser) return;

    const { error } = await supabase
      .from('user_roles')
      .update({ role: selectedRole as 'user' | 'business' | 'admin' })
      .eq('user_id', selectedUser.user_id);

    if (error) {
      toast.error('Chyba pri zmene role');
      return;
    }

    toast.success('Rola zmenená');
    setDialogMode(null);
    fetchUsers();
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    return fullName.includes(searchLower) || user.user_id.includes(searchLower);
  });

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Používatelia</h2>
          <p className="text-sm text-muted-foreground">{users.length} celkom</p>
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

        {/* Users Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meno</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead className="text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {user.first_name || user.last_name
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                              : 'Bez mena'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.user_id.slice(0, 8)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-red-500/10 text-red-500'
                              : user.role === 'business'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            user.onboarding_completed
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-orange-500/10 text-orange-500'
                          }`}
                        >
                          {user.onboarding_completed ? 'Dokončený' : 'Nedokončený'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewUser(user)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditUser(user)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleChangeRole(user)}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendPasswordReset(user)}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* View Dialog */}
        <Dialog open={dialogMode === 'view'} onOpenChange={() => setDialogMode(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail používateľa</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Meno</Label>
                  <p className="font-medium">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vek</Label>
                  <p className="font-medium">{selectedUser.age || 'Neuvedený'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Pohlavie</Label>
                  <p className="font-medium">{selectedUser.gender || 'Neuvedené'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rola</Label>
                  <p className="font-medium">{selectedUser.role}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Registrácia</Label>
                  <p className="font-medium">
                    {new Date(selectedUser.created_at).toLocaleDateString('sk-SK')}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={dialogMode === 'edit'} onOpenChange={() => setDialogMode(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upraviť používateľa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              <Button onClick={saveUserEdit} className="w-full">
                Uložiť
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Role Dialog */}
        <Dialog open={dialogMode === 'role'} onOpenChange={() => setDialogMode(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zmeniť rolu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rola</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveRoleChange} className="w-full">
                Uložiť
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default UsersManagement;
