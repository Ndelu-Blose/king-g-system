import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { useInventory } from '@/contexts/InventoryContext';
import type { StockLocation } from '@/contexts/InventoryContext';
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
import { toast } from 'sonner';

export default function TransferStock() {
  const { inventory, transferStock } = useInventory();
  const [productId, setProductId] = useState('');
  const [fromLocation, setFromLocation] = useState<StockLocation>('warehouse');
  const [toLocation, setToLocation] = useState<StockLocation>('lounge');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const product = inventory.find((i) => i.productId === productId);
  const fromQty = product
    ? fromLocation === 'lounge'
      ? product.loungeQty
      : product.warehouseQty
    : 0;
  const maxQty = Math.max(0, fromQty);
  const qtyNum = parseInt(qty, 10);
  const validQty = !Number.isNaN(qtyNum) && qtyNum > 0 && qtyNum <= maxQty;
  const validLocations = fromLocation !== toLocation;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !validQty || !validLocations) return;
    transferStock(productId, qtyNum, fromLocation, toLocation);
    setSubmitted(true);
    setProductId('');
    setQty('');
    setReason('');
    toast.success(`${qtyNum} unit(s) transferred from ${fromLocation} to ${toLocation}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/inventory" label="Back to Inventory" />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ArrowRightLeft className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Transfer Stock</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Move stock between Lounge and Warehouse. Select product, direction, and quantity.
        </p>
      </div>

      {submitted ? (
        <div className="glass-card p-6 text-center">
          <p className="text-foreground font-medium mb-2">Transfer recorded successfully.</p>
          <Button variant="outline" onClick={() => setSubmitted(false)} className="mt-2">
            New transfer
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card p-6 max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={setProductId} required>
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
              <Label>From</Label>
              <Select
                value={fromLocation}
                onValueChange={(v) => {
                  setFromLocation(v as Location);
                  setToLocation(v === 'lounge' ? 'warehouse' : 'lounge');
                }}
              >
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
              <Label>To</Label>
              <Select
                value={toLocation}
                onValueChange={(v) => setToLocation(v as Location)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lounge">Lounge</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {product && (
            <p className="text-sm text-muted-foreground">
              Available in {fromLocation}: <strong>{fromQty}</strong> units
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              type="text"
              placeholder="e.g. Restock lounge bar"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
            {product && maxQty === 0 && (
              <p className="text-xs text-destructive">No stock in {fromLocation} to transfer.</p>
            )}
          </div>

          {!validLocations && (
            <p className="text-sm text-destructive">From and To must be different.</p>
          )}
          <Button type="submit" disabled={!productId || !validQty || !validLocations}>
            Transfer
          </Button>
        </form>
      )}
    </div>
  );
}
