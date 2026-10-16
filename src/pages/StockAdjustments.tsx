import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BackButton } from '@/components/BackButton';
import { StockMovementsTable } from '@/components/StockMovementsTable';
import { useInventory } from '@/contexts/InventoryContext';
import type { StockLocation } from '@/contexts/InventoryContext';
import { getStockMovements, writeOffStockApi } from '@/lib/pos-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { friendlyErrorMessage } from '@/lib/friendly-error';
import { toast } from 'sonner';

const REASONS = [
  { value: 'expired', label: 'Expired' },
  { value: 'broken', label: 'Broken bottle' },
] as const;

export default function StockAdjustments() {
  const { inventory, refreshInventory } = useInventory();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState('');
  const [location, setLocation] = useState<StockLocation>('lounge');
  const [reasonCode, setReasonCode] = useState<'expired' | 'broken'>('broken');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const product = inventory.find((i) => i.productId === productId);
  const available = product ? (location === 'lounge' ? product.loungeQty : product.warehouseQty) : 0;
  const qtyNum = parseInt(qty, 10);
  const validQty = !Number.isNaN(qtyNum) && qtyNum > 0 && qtyNum <= available;

  const { data: writeOffs = [], isLoading, isError } = useQuery({
    queryKey: ['stock-movements', 'write-offs'],
    queryFn: () => getStockMovements({ type: 'ADJUSTMENT' }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !productId || !validQty) {
      toast.error('Select a product, a location, and a quantity that location holds.');
      return;
    }
    setSaving(true);
    try {
      await writeOffStockApi({ productId, qty: qtyNum, location, reasonCode });
      await refreshInventory();
      await queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      setQty('');
      toast.success(`${qtyNum} removed from ${location} (${reasonCode === 'expired' ? 'expired' : 'broken bottle'}).`);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, 'Could not record the write-off.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/inventory" label="Back to Inventory" />
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Write off stock</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Remove expired stock or broken bottles from the lounge or the warehouse. A sale is not the only way stock goes down.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product">Product</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="product">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {inventory.map((i) => (
                <SelectItem key={i.productId} value={i.productId}>
                  {i.productName} (Lounge: {i.loungeQty}, Warehouse: {i.warehouseQty})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={location} onValueChange={(v) => setLocation(v as StockLocation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lounge">Lounge</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as 'expired' | 'broken')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {product && (
          <p className="text-sm text-muted-foreground">
            Available in {location}: <strong>{available}</strong>
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="qty">Quantity</Label>
          <Input
            id="qty"
            type="number"
            min={1}
            max={available || undefined}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </div>

        <Button type="submit" disabled={!productId || !validQty || saving}>
          {saving ? 'Saving…' : 'Remove from stock'}
        </Button>
      </form>

      <div className="glass-card overflow-hidden">
        <h2 className="font-display text-lg font-semibold text-foreground px-5 pt-5 pb-2">Recorded write-offs</h2>
        <StockMovementsTable
          movements={writeOffs}
          isLoading={isLoading}
          isError={isError}
          emptyText="No expired or broken stock recorded yet."
        />
      </div>
    </div>
  );
}
