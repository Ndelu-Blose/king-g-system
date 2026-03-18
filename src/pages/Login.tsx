import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const loggedInUser = login(email, password);
    if (loggedInUser) {
      navigate(loggedInUser.role === 'cashier' ? '/pos' : '/dashboard');
    } else {
      setError('Invalid credentials. Try: owner@kingg.co.za');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl gold-gradient pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="King G"
            className="mx-auto w-20 h-20 object-contain mb-4"
          />
          <h1 className="font-display text-3xl font-bold tracking-wide text-foreground">KING G</h1>
          <p className="text-muted-foreground mt-1">Lifestyle & Lounge</p>
          <p className="text-xs text-muted-foreground mt-1">Enterprise POS System</p>
        </div>

        {/* Form */}
        <div className="glass-card p-8">
          <h2 className="font-display text-xl font-semibold text-foreground mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="you@kingg.co.za"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all pr-12"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-lg gold-gradient text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity gold-glow"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Demo accounts (any password):</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { email: 'owner@kingg.co.za', role: 'Owner' },
                { email: 'thabo@kingg.co.za', role: 'Sr. Manager' },
                { email: 'lerato@kingg.co.za', role: 'Manager' },
                { email: 'sipho@kingg.co.za', role: 'Cashier' },
              ].map(a => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword('demo'); }}
                  className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-sidebar-accent transition-colors text-left"
                >
                  <span className="text-primary font-medium">{a.role}</span>
                  <br />
                  <span className="text-muted-foreground">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
