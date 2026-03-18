import { ClipboardList, Clock, DollarSign, User } from 'lucide-react';
import { dailyStats } from '@/lib/mock-data';
import { BackButton } from '@/components/BackButton';

export default function ShiftSummary() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Shift Summary</h1>
        <p className="text-sm text-muted-foreground">Overview of current or selected shift performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card card-hover p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shift Sales</p>
            <p className="text-xl font-bold text-foreground mt-1">R{dailyStats.totalSales.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card card-hover p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold text-foreground mt-1">{dailyStats.transactionCount}</p>
          </div>
        </div>
        <div className="glass-card card-hover p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg. Transaction</p>
            <p className="text-xl font-bold text-foreground mt-1">R{dailyStats.avgTransaction.toFixed(0)}</p>
          </div>
        </div>
        <div className="glass-card card-hover p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cashiers on Shift</p>
            <p className="text-xl font-bold text-foreground mt-1">—</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">Shift breakdown</h3>
        <p className="text-sm text-muted-foreground">
          Select a date or shift to view cashier-wise sales, opening/closing counts, and variance. Use Reports for detailed exports.
        </p>
      </div>
    </div>
  );
}
