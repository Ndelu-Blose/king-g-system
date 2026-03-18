import { useQuery } from '@tanstack/react-query';
import { mockTransactions, type Transaction } from '@/lib/mock-data';
import { getTransactionsFromApi } from '@/lib/pos-api';
import { useShift } from '@/contexts/ShiftContext';
import { History, User, CreditCard, Banknote, Clock } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

const REFETCH_MS = 3000;

export default function TransactionHistory() {
  const { sessionSales } = useShift();
  const { data: apiTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => getTransactionsFromApi(null),
    refetchInterval: REFETCH_MS,
    staleTime: 2000,
  });

  const allTransactions: Transaction[] = Array.isArray(apiTransactions)
    ? apiTransactions
    : [...mockTransactions, ...sessionSales].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

  const sorted = [...allTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Transaction History</h1>
        <p className="text-sm text-muted-foreground">
          All sales with cashier attribution
          {apiTransactions && <span className="ml-2 text-primary">Live from database</span>}
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cashier</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(txn => (
                <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{txn.id}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{txn.cashierName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {txn.items.map(i => `${i.productName} × ${i.qty}`).join(', ')}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">R{txn.total.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {txn.paymentMethod === 'cash' ? (
                        <Banknote className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="capitalize">{txn.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {new Date(txn.createdAt).toLocaleString('en-ZA', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      txn.status === 'completed' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                      txn.status === 'void' ? 'bg-destructive/15 text-destructive' :
                      'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
