import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BackButton } from '@/components/BackButton';

type MovementType = 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'DAMAGE' | 'RECEIPT';

interface Movement {
  id: string;
  date: string;
  type: MovementType;
  product: string;
  qty: number;
  reference?: string;
}

const mockMovements: Movement[] = [
  { id: '1', date: '2026-02-26 14:32', type: 'SALE', product: 'Hennessy VS', qty: -2, reference: 'TXN-001' },
  { id: '2', date: '2026-02-26 12:10', type: 'TRANSFER', product: 'Castle Lager 340ml', qty: 24, reference: 'WH → Lounge' },
  { id: '3', date: '2026-02-26 11:00', type: 'RECEIPT', product: 'Heineken 330ml', qty: 48, reference: 'PO-102' },
  { id: '4', date: '2026-02-25 16:45', type: 'ADJUSTMENT', product: 'Moët & Chandon', qty: -1, reference: 'Stock take' },
  { id: '5', date: '2026-02-25 10:20', type: 'DAMAGE', product: 'Red Bull Energy', qty: -3, reference: 'Broken cans' },
];

export default function InventoryMovementsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered =
    typeFilter === 'all'
      ? mockMovements
      : mockMovements.filter((m) => m.type === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Inventory Movements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            SALE, TRANSFER, ADJUSTMENT, DAMAGE, RECEIPT.
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="SALE">SALE</SelectItem>
            <SelectItem value="TRANSFER">TRANSFER</SelectItem>
            <SelectItem value="ADJUSTMENT">ADJUSTMENT</SelectItem>
            <SelectItem value="DAMAGE">DAMAGE</SelectItem>
            <SelectItem value="RECEIPT">RECEIPT</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Qty</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Reference</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 text-muted-foreground">{m.date}</td>
                <td className="px-5 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                    {m.type}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-foreground">{m.product}</td>
                <td className="px-5 py-3 text-right">
                  <span className={m.qty >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {m.qty >= 0 ? '+' : ''}{m.qty}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{m.reference || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
