import { Link } from 'react-router-dom';
import { ArrowRightLeft, ChevronRight } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

export default function StockAdjustments() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/inventory" label="Back to Inventory" />
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Transfer stock</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Move stock between the lounge and the warehouse. Pick the product, how many units, and whether you’re moving them in or out of the lounge.
        </p>
      </div>

      <Link
        to="/inventory/transfer"
        className="glass-card card-hover p-6 flex items-center gap-5 block transition-all hover:ring-2 hover:ring-primary/20 rounded-xl max-w-xl"
      >
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-7 h-7 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-foreground">Start a transfer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose product, from/to locations, and quantity. Stock levels update immediately.
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </Link>
    </div>
  );
}
