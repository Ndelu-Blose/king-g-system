import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { establishRecoverySession } from '@/lib/recovery-session';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const VERIFY_TIMEOUT_MS = 12_000;

const LINK_EXPIRED_MESSAGE =
  'This link is invalid or has expired. On the sign-in page, enter your email and choose Forgot password? to get a new link.';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Password reset is not available. Contact an owner for help.');
      return;
    }

    const supabase = getSupabase();
    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      setReady(true);
      setError('');
    };

    const verifyRecoverySession = async () => {
      const hasSession = await establishRecoverySession(supabase);
      if (cancelled) return;
      if (hasSession) {
        markReady();
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void verifyRecoverySession();
      }
    });

    void verifyRecoverySession();

    const timeout = window.setTimeout(async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled || data.session) return;
      setError(LINK_EXPIRED_MESSAGE);
    }, VERIFY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Failed to update password.');
        return;
      }
      setMessage('Password updated. You can sign in with your new password.');
      await getSupabase().auth.signOut();
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[760px] rounded-full opacity-10 blur-3xl gold-gradient pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md glass-card rounded-3xl p-8 border-border/70 relative"
      >
        <h1 className="font-display text-2xl font-semibold text-foreground mb-2">Set new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose a new password for your King G account.
        </p>

        {!ready && !error && (
          <p className="text-sm text-muted-foreground mb-4">Verifying your reset link…</p>
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        {message && <p className="text-sm text-muted-foreground mb-4">{message}</p>}

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-secondary/40 border border-border/70 text-foreground pr-12"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Confirm password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-secondary/40 border border-border/70 text-foreground"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl gold-gradient text-primary-foreground font-semibold disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="text-sm text-muted-foreground mt-6 text-center">
          <Link to="/login" className="text-[hsl(32_45%_58%)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
