import type { StockMovement } from '@/lib/pos-api';

const LOCATION_LABELS: Record<string, string> = { lounge: 'Lounge', warehouse: 'Warehouse' };

function locationLabel(loc: string | null): string {
  if (!loc) return '';
  return LOCATION_LABELS[loc] ?? loc;
}

export function formatMovementWhere(movement: StockMovement): string {
  if (movement.type === 'TRANSFER') {
    return `${locationLabel(movement.fromLocation)} → ${locationLabel(movement.toLocation)}`;
  }
  return locationLabel(movement.toLocation ?? movement.fromLocation) || '—';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

interface StockMovementsTableProps {
  movements: StockMovement[];
  isLoading?: boolean;
  isError?: boolean;
  emptyText?: string;
}

export function StockMovementsTable({
  movements,
  isLoading = false,
  isError = false,
  emptyText = 'No stock movements found.',
}: StockMovementsTableProps) {
  if (isLoading) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading stock movements…</p>;
  }
  if (isError) {
    return (
      <p className="px-5 py-10 text-center text-sm text-destructive">
        Could not load stock movements. Check your connection and try again.
      </p>
    );
  }
  if (movements.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th>
            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Qty</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Location</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Reference</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">By</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => {
            const details = [m.reference, m.supplier, m.reason].filter(Boolean).join(' · ');
            return (
              <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(m.createdAt)}</td>
                <td className="px-5 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{m.type}</span>
                </td>
                <td className="px-5 py-3 font-medium text-foreground">{m.productName}</td>
                <td className="px-5 py-3 text-right text-foreground">{m.qty}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatMovementWhere(m)}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{details || '—'}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{m.actorName || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
