import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { useInventory } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function StockTake() {
  const { inventory, applyStockTake } = useInventory();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const getCount = (productId: string) => {
    const v = counts[productId];
    if (v === '' || v === undefined) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  const rows = inventory.map((item) => {
    const systemQty = item.totalQty;
    const counted = getCount(item.productId);
    const variance = counted !== null ? counted - systemQty : null;
    return { ...item, counted, variance };
  });

  const hasVariance = rows.some((r) => r.variance !== null && r.variance !== 0);
  const allCounted = rows.every((r) => getCount(r.productId) !== null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allCounted) {
      toast.error('Enter a count for every product.');
      return;
    }
    rows.forEach((r) => {
      const counted = getCount(r.productId);
      if (counted !== null) applyStockTake(r.productId, counted);
    });
    setSubmitted(true);
    const variances = rows.filter((r) => r.variance !== null && r.variance !== 0);
    toast.success(
      variances.length > 0
        ? `Stock take complete. ${variances.length} variance(s) applied to inventory.`
        : 'Stock take complete. Counts applied.'
    );
  };

  const setCount = (productId: string, value: string) => {
    setCounts((prev) => ({ ...prev, [productId]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/inventory" label="Back to Inventory" />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Stock Take</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Enter what you actually counted. We’ll compare to the system and apply any difference to stock.
        </p>
      </div>

      {submitted ? (
        <div className="glass-card p-6 text-center">
          <p className="text-foreground font-medium mb-2">Stock take submitted successfully.</p>
          <Button variant="outline" onClick={() => setSubmitted(false)} className="mt-2">
            New stock take
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">System qty</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Counted</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.productId} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{row.productName}</td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{row.category}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-right text-muted-foreground">{row.totalQty}</td>
                    <td className="px-5 py-3 text-right">
                      <Input
                        type="number"
                        min={0}
                        className="w-20 text-right h-9"
                        value={counts[row.productId] ?? ''}
                        onChange={(e) => setCount(row.productId, e.target.value)}
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {row.variance !== null ? (
                        <span className={row.variance !== 0 ? 'font-semibold text-warning' : 'text-muted-foreground'}>
                          {row.variance > 0 ? '+' : ''}{row.variance}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={!allCounted}>
              Complete stock take
            </Button>
            {hasVariance && (
              <span className="text-sm text-amber-600 dark:text-amber-400">Variances will be applied to inventory (warehouse/lounge adjusted).</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
