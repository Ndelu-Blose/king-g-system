import { useMemo, useState } from 'react';
import { CalendarClock, DollarSign, User, AlertTriangle } from 'lucide-react';
import { getShiftHistory } from '@/lib/shift-history';
import { mockUsers } from '@/lib/mock-data';
import { BackButton } from '@/components/BackButton';

export default function ShiftsAttendancePage() {
  const [history, setHistory] = useState(() => getShiftHistory());
  const cashiers = useMemo(() => mockUsers.filter((u) => u.role === 'cashier'), []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-ZA', { dateStyle: 'short' });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  // Refresh from storage (e.g. after a cashier closes a shift in another tab/session)
  const refresh = () => setHistory(getShiftHistory());

  const withVariance = history.filter((s) => s.variance !== 0);
  const totalVariance = withVariance.reduce((sum, s) => sum + s.variance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Shifts & attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          See who closed a shift and how their till counted. Check variance and notes in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shifts recorded</p>
            <p className="text-xl font-bold text-foreground mt-1">{history.length}</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cashiers</p>
            <p className="text-xl font-bold text-foreground mt-1">{cashiers.length}</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shifts with variance</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {withVariance.length}
              {withVariance.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  (total R{totalVariance.toFixed(2)})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">Shift history</h2>
          <button
            type="button"
            onClick={refresh}
            className="text-sm text-primary hover:underline font-medium"
          >
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarClock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No closed shifts yet.</p>
            <p className="text-muted-foreground text-xs mt-1">When your team ends their shift and does cash-up, their records will show here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cashier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opened</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Closed</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expected (R)</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Counted (R)</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variance</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{s.cashierName}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {formatDate(s.openedAt)} {formatTime(s.openedAt)}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {formatDate(s.closedAt)} {formatTime(s.closedAt)}
                    </td>
                    <td className="px-5 py-3 text-sm text-right tabular-nums">{s.expectedCash.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm text-right tabular-nums">{s.countedCash.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={
                          s.variance === 0
                            ? 'text-muted-foreground'
                            : s.variance > 0
                              ? 'text-green-600 dark:text-green-400 font-medium'
                              : 'text-red-600 dark:text-red-400 font-medium'
                        }
                      >
                        {s.variance >= 0 ? '+' : ''}R{s.variance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground max-w-[200px] truncate" title={s.notes}>
                      {s.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
