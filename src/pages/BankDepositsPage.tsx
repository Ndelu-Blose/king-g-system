import { useState } from 'react';
import { Landmark, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';

interface Deposit {
  id: string;
  date: string;
  amount: number;
  status: 'pending' | 'completed';
  reference?: string;
}

const mockDeposits: Deposit[] = [
  { id: '1', date: '2026-02-26', amount: 5200, status: 'pending' },
  { id: '2', date: '2026-02-25', amount: 4800, status: 'completed', reference: 'DEP-2026-025' },
  { id: '3', date: '2026-02-24', amount: 6100, status: 'completed', reference: 'DEP-2026-024' },
];

export default function BankDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>(mockDeposits);

  const markCompleted = (id: string) => {
    setDeposits((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: 'completed' as const, reference: `DEP-${Date.now().toString().slice(-6)}` }
          : d
      )
    );
  };

  const pending = deposits.filter((d) => d.status === 'pending');
  const unbanked = pending.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          Bank Deposits
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pending and completed deposits. Unbanked cash tracking.
        </p>
      </div>

      {unbanked > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-foreground">
            Unbanked cash: <span className="text-amber-600 dark:text-amber-400">R{unbanked.toLocaleString()}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pending.length} pending deposit(s). Mark as completed when deposited.
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Reference</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 text-foreground">{d.date}</td>
                <td className="px-5 py-3 text-right font-medium text-foreground">R{d.amount.toLocaleString()}</td>
                <td className="px-5 py-3">
                  {d.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Check className="h-3.5 w-3.5" /> Completed
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{d.reference || '—'}</td>
                <td className="px-5 py-3 text-right">
                  {d.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => markCompleted(d.id)}>
                      Mark completed
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
