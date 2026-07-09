import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { requestPasswordReset } from '@/lib/auth-api';
import { getApiBase, usesLocalApiProxy } from '@/lib/api-base';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const canResetPassword = isSupabaseConfigured || Boolean(getApiBase()) || usesLocalApiProxy();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setResetMessage('');
    setSubmitting(true);
    try {
      const outcome = await login(email, password);
      if ('user' in outcome) {
        navigate(outcome.user.role === 'cashier' ? '/pos' : '/dashboard');
      } else {
        setError(outcome.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[760px] rounded-full opacity-10 blur-3xl gold-gradient pointer-events-none" />
      <div className="absolute top-20 left-0 w-[420px] h-[420px] rounded-full opacity-10 blur-3xl gold-gradient pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full"
          >
            <div className="relative">
              <div className="absolute -top-6 -left-6 w-72 h-72 rounded-full opacity-10 blur-3xl gold-gradient pointer-events-none" />

              <div className="relative">
                <div className="flex items-center gap-4">
                  <img
                    src="/logo.png"
                    alt="King G"
                    className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
                  />
                  <div>
                    <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-wide text-foreground">
                      KING G
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm lg:text-base">Lifestyle Lounge</p>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full"
          >
            <div className="glass-card rounded-3xl p-8 lg:p-10 relative border-border/70 shadow-[0_30px_120px_-60px_hsl(32_45%_58%/0.35)]">
              <div className="pointer-events-none absolute -top-10 -left-10 w-72 h-72 rounded-full opacity-10 blur-3xl gold-gradient" />
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-80 h-80 rounded-full opacity-10 blur-3xl gold-gradient" />
              <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
                Sign in
              </h2>
              <p className="text-sm text-muted-foreground mb-8">
                Enter your credentials to access King G operations.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-secondary/40 border border-border/70 text-foreground shadow-inner focus:outline-none focus:ring-2 focus:ring-[hsl(32_45%_58%_/_0.55)] focus:border-transparent transition-colors"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-secondary/40 border border-border/70 text-foreground shadow-inner focus:outline-none focus:ring-2 focus:ring-[hsl(32_45%_58%_/_0.55)] focus:border-transparent transition-colors pr-12"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
                {resetMessage && <p className="text-sm text-muted-foreground">{resetMessage}</p>}

                {canResetPassword && (
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={async () => {
                      if (!email.trim()) {
                        setError('Enter your email address above, then click Forgot password?.');
                        return;
                      }
                      setError('');
                      setResetMessage('');
                      setResetting(true);
                      try {
                        const result = await requestPasswordReset(email);
                        if (result.ok) {
                          setResetMessage('If this email is registered, a reset link was sent. Check your inbox.');
                        } else {
                          setError(result.error);
                        }
                      } finally {
                        setResetting(false);
                      }
                    }}
                    className="text-sm text-[hsl(32_45%_58%)] hover:underline disabled:opacity-50"
                  >
                    {resetting ? 'Sending…' : 'Forgot password?'}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl gold-gradient text-primary-foreground font-semibold text-base hover:opacity-95 transition-all gold-glow transform-gpu hover:-translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-[hsl(32_45%_58%_/_0.55)] active:translate-y-0 disabled:opacity-60"
                >
                  {submitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
