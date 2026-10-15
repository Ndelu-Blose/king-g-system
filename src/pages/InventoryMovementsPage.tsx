import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BackButton } from '@/components/BackButton';
import { StockMovementsTable } from '@/components/StockMovementsTable';
import { getStockMovements, type StockMovementType } from '@/lib/pos-api';

const TYPE_OPTIONS: StockMovementType[] = ['RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'COUNT'];

export default function InventoryMovementsPage() {
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'all'>('all');

  const { data: movements = [], isLoading, isError } = useQuery({
    queryKey: ['stock-movements', 'page', typeFilter],
    queryFn: () => getStockMovements({ type: typeFilter }),
  });

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
            Stock received, transferred, adjusted and counted, newest first.
          </p>
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as StockMovementType | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <StockMovementsTable movements={movements} isLoading={isLoading} isError={isError} />
      </div>
    </div>
  );
}
