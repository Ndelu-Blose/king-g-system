import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Mail, MoreHorizontal, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { ManagedUser, UserRole } from '@/lib/types';
import { roleLabels } from '@/lib/types';
import {
  ApiAuthError,
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUsers,
  sendUserWelcomeEmail,
  updateUser,
} from '@/lib/users-api';

const ROLE_OPTIONS: UserRole[] = ['cashier', 'manager', 'senior_manager', 'owner'];

const emptyForm = { name: '', email: '', role: 'cashier' as UserRole, password: '' };

export default function UsersPage() {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<{ user: ManagedUser; activate: boolean } | null>(null);

  const [adding, setAdding] = useState(false);
  const [sendingWelcomeId, setSendingWelcomeId] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (e) {
      if (e instanceof ApiAuthError) {
        logout();
        toast.error('Session expired. Please sign in again.');
        return;
      }
      const msg = e instanceof Error ? e.message : 'Failed to load users';
      toast.error(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadUsers();
  }, [loadUsers, currentUser]);

  const handleAddUser = async () => {
    if (adding) return;
    const name = addForm.name.trim();
    const email = addForm.email.trim();
    const password = addForm.password;
    if (!name) {
      toast.error('Name is required.');
      return;
    }
    if (!email) {
      toast.error('Email is required.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      setAdding(true);
      const created = await createUser({ name, email, role: addForm.role, password });
      if (created.emailSent) {
        toast.success(`"${name}" added. Welcome email sent to ${email}.`);
      } else {
        toast.warning(`"${name}" added, but the welcome email could not be sent.`, { duration: 8000 });
      }
      setAddOpen(false);
      setAddForm(emptyForm);
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  const handleSendWelcome = async (target: ManagedUser) => {
    if (sendingWelcomeId) return;
    try {
      setSendingWelcomeId(target.id);
      await sendUserWelcomeEmail(target.id);
      toast.success(`Welcome email sent to ${target.email}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send welcome email');
    } finally {
      setSendingWelcomeId(null);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordTarget || savingPassword) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      setSavingPassword(true);
      await changeUserPassword(passwordTarget.id, newPassword);
      toast.success(`Password updated for ${passwordTarget.name}.`);
      setPasswordTarget(null);
      setNewPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget || togglingActive) return;
    const { user: target, activate } = toggleTarget;
    try {
      setTogglingActive(true);
      await updateUser(target.id, { active: activate });
      toast.success(activate ? `${target.name} reactivated.` : `${target.name} deactivated.`);
      setToggleTarget(null);
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleRoleChange = async (target: ManagedUser, role: UserRole) => {
    if (role === target.role || savingRoleId) return;
    try {
      setSavingRoleId(target.id);
      await updateUser(target.id, { role });
      toast.success(`Role updated for ${target.name}.`);
      await loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setSavingRoleId(null);
    }
  };

  const isSelf = (id: string) => currentUser?.id === id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Add staff, set roles, and reset passwords.</p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="gap-2 gold-gradient text-primary-foreground"
        >
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No users yet. Add your first user with the button above.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    {isSelf(u.id) && (
                      <p className="text-xs text-muted-foreground">Signed in as you</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-4">
                    <Select
                      value={u.role}
                      onValueChange={(v) => handleRoleChange(u, v as UserRole)}
                      disabled={isSelf(u.id) || savingRoleId === u.id}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {roleLabels[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.active
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setPasswordTarget(u);
                            setNewPassword('');
                          }}
                        >
                          <KeyRound className="w-4 h-4 mr-2" />
                          Change password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSendWelcome(u)}
                          disabled={sendingWelcomeId === u.id}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {sendingWelcomeId === u.id ? 'Sending…' : 'Send welcome email'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {u.active ? (
                          <DropdownMenuItem
                            disabled={isSelf(u.id)}
                            onClick={() => setToggleTarget({ user: u, activate: false })}
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setToggleTarget({ user: u, activate: true })}>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isSelf(u.id)}
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              They will receive a welcome email with a link to set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(v) => setAddForm((p) => ({ ...p, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button className="gold-gradient text-primary-foreground" onClick={handleAddUser} disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                'Add user'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setNewPassword('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordTarget?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPasswordTarget(null)}>
              Cancel
            </Button>
            <Button
              className="gold-gradient text-primary-foreground"
              onClick={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.activate ? 'Reactivate user?' : 'Deactivate user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.activate
                ? `${toggleTarget.user.name} will be able to sign in again.`
                : `${toggleTarget?.user.name} will not be able to sign in until reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={togglingActive}>
              {togglingActive ? 'Processing…' : toggleTarget?.activate ? 'Reactivate' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-medium text-foreground">{deleteTarget?.name}</span> (
              {deleteTarget?.email}) from the system. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
