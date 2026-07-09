import { useEffect, useState } from 'react';
import { UserCircle, Save, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { requestPasswordReset } from '@/lib/auth-api';
import { changePassword, fetchProfile, updateProfile } from '@/lib/profile-api';
import { roleLabels } from '@/lib/types';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const profile = (await fetchProfile()) ?? user;
        if (cancelled || !profile) return;
        setName(profile.name);
        setEmail(profile.email);
        setPhone(profile.phone ?? '');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
      });
      refreshUser(updated);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || changingPassword) return;
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(user.email, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email || sendingReset) return;
    setSendingReset(true);
    try {
      const result = await requestPasswordReset(user.email);
      if (result.ok) {
        toast.success('If your account supports email reset, a link was sent to your inbox.');
      } else {
        toast.error(result.error);
      }
    } finally {
      setSendingReset(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" />
          My profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your contact details and password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Your role is {roleLabels[user.role]} and can only be changed by an owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading profile…</p>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27 …"
                  autoComplete="tel"
                />
              </div>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Password
          </CardTitle>
          <CardDescription>Change your sign-in password or request a reset email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={changingPassword || !currentPassword}>
              {changingPassword ? 'Updating…' : 'Change password'}
            </Button>
          </form>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Forgot your current password? We can email you a reset link.
            </p>
            <Button type="button" variant="outline" disabled={sendingReset} onClick={handleForgotPassword}>
              {sendingReset ? 'Sending…' : 'Email password reset link'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
