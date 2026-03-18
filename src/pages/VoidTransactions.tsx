import { useState } from 'react';
import { Ban } from 'lucide-react';
import { mockTransactions } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { AuthorizeVoidDialog } from '@/components/AuthorizeVoidDialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { Transaction } from '@/lib/mock-data';
import { BackButton } from '@/components/BackButton';

interface VoidTransactionsProps {
  hideTitle?: boolean;
}

export default function VoidTransactions({ hideTitle }: VoidTransactionsProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);

  const handleVoidConfirm = (_pin: string, _reason: string) => {
    if (!voidTarget) return;
    setTransactions((prev) => prev.filter((t) => t.id !== voidTarget.id));
    setVoidTarget(null);
    toast.success(`Transaction ${voidTarget.id} voided. Authorized by ${user?.name ?? 'manager'}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      {!hideTitle && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-6 h-6 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Void transactions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            View recent transactions and void incorrect sales. Voiding requires your PIN; all voids are logged with your authorization.
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Transaction</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Cashier</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Items</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 font-medium text-foreground">{txn.id}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{txn.cashierName}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  {txn.items.map((i) => `${i.productName} × ${i.qty}`).join(', ')}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-foreground">R{txn.total}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  {new Date(txn.createdAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-5 py-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => setVoidTarget(txn)}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Void
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AuthorizeVoidDialog
        open={!!voidTarget}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        transaction={voidTarget ? { id: voidTarget.id, total: voidTarget.total } : null}
        onConfirm={handleVoidConfirm}
      />
    </div>
  );
}
