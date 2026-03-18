import { useMemo } from 'react';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { useShift } from '@/contexts/ShiftContext';
import { BackButton } from '@/components/BackButton';

export default function ShiftHistoryPage() {
  const { activityLog } = useShift();

  const entries = useMemo(
    () =>
      [...activityLog]
        .filter((e) => e.type === 'open' || e.type === 'close')
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [activityLog]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Shift history</h1>
        <p className="text-sm text-muted-foreground mt-1">
          When you started and ended your shifts. No sales data — only your shift open and close times.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          No shift history yet. Open a shift and end it to see when each shift started and ended.
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Event
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        {new Date(entry.at).toLocaleString('en-ZA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {entry.type === 'open' && (
                          <>
                            <LogIn className="h-4 w-4 text-success shrink-0" />
                            <span className="font-medium text-foreground">Shift started</span>
                          </>
                        )}
                        {entry.type === 'close' && (
                          <>
                            <LogOut className="h-4 w-4 text-amber-500 shrink-0" />
                            <span className="font-medium text-foreground">Shift ended</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {entry.type === 'open' && <span className="text-muted-foreground">—</span>}
                      {entry.type === 'close' && entry.details && (
                        <span>
                          {entry.details.counted != null && (
                            <>Counted R{entry.details.counted.toFixed(2)}</>
                          )}
                          {entry.details.notes && (
                            <span className="ml-2">— {entry.details.notes}</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
