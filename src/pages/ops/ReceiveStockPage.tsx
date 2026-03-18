import { useState } from 'react';
import { PackagePlus, Truck, ClipboardList, CheckCircle, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
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
import { format } from 'date-fns';
import { BackButton } from '@/components/BackButton';

const SUPPLIER_OPTIONS = ['SA Breweries', 'Distell Group', 'Pernod Ricard SA', 'Coca-Cola Beverages'];

const DISCREPANCY_REASONS = [
  'Supplier short delivery',
  'Damaged goods',
  'Counting error',
] as const;

type Step = 1 | 2 | 3 | 4;

interface ExpectedLine {
  id: string;
  productId: string;
  quantity: number;
  costPrice?: number;
  batchNumber?: string;
  deliveryDate: string;
}

interface VerifiedLine extends ExpectedLine {
  actualQuantity: number;
  discrepancyReason?: (typeof DISCREPANCY_REASONS)[number];
}

export default function ReceiveStockPage() {
  const { user } = useAuth();
  const { inventory, receiveStock } = useInventory();

  const [step, setStep] = useState<Step>(1);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [lines, setLines] = useState<ExpectedLine[]>([]);
  const [verifiedLines, setVerifiedLines] = useState<VerifiedLine[]>([]);
  const [location, setLocation] = useState<StockLocation>('warehouse');
  const [confirmed, setConfirmed] = useState(false);

  // Step 2: add line form
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addCostPrice, setAddCostPrice] = useState('');
  const [addBatch, setAddBatch] = useState('');
  const [addDeliveryDate, setAddDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const canProceedStep1 = supplier.trim() && invoiceNumber.trim() && deliveryReference.trim();
  const canProceedStep2 = lines.length > 0;
  const canProceedStep3 = verifiedLines.length === lines.length && verifiedLines.every((l) => l.actualQuantity >= 0);

  const addLine = () => {
    const qty = parseInt(addQty, 10);
    if (!addProductId || Number.isNaN(qty) || qty <= 0) {
      toast.error('Select a product and enter a valid quantity.');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        id: `L-${Date.now()}-${prev.length}`,
        productId: addProductId,
        quantity: qty,
        costPrice: addCostPrice ? parseFloat(addCostPrice) : undefined,
        batchNumber: addBatch.trim() || undefined,
        deliveryDate: addDeliveryDate || format(new Date(), 'yyyy-MM-dd'),
      },
    ]);
    setAddProductId('');
    setAddQty('');
    setAddCostPrice('');
    setAddBatch('');
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setVerifiedLines((prev) => prev.filter((l) => l.id !== id));
  };

  const goToStep2 = () => {
    if (!canProceedStep1) return;
    setStep(2);
  };

  const goToStep3 = () => {
    if (!canProceedStep2) return;
    setVerifiedLines(
      lines.map((l) => ({
        ...l,
        actualQuantity: l.quantity,
        discrepancyReason: undefined,
      }))
    );
    setStep(3);
  };

  const setActualQty = (lineId: string, actual: number) => {
    setVerifiedLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, actualQuantity: actual } : l))
    );
  };

  const setDiscrepancyReason = (lineId: string, reason: (typeof DISCREPANCY_REASONS)[number] | '') => {
    setVerifiedLines((prev) =>
      prev.map((l) =>
        l.id === lineId ? { ...l, discrepancyReason: reason || undefined } : l
      )
    );
  };

  const confirmIntake = () => {
    if (!canProceedStep3 || !user) return;
    for (const line of verifiedLines) {
      const qtyToReceive = line.actualQuantity;
      if (qtyToReceive > 0) {
        receiveStock(line.productId, qtyToReceive, location);
      }
    }
    setConfirmed(true);
    toast.success(
      `Stock intake confirmed. ${verifiedLines.filter((l) => l.actualQuantity > 0).length} line(s) updated. Audit trail: ${supplier}, ${invoiceNumber}, ${user.name}.`
    );
  };

  const startNewDelivery = () => {
    setStep(1);
    setSupplier('');
    setInvoiceNumber('');
    setDeliveryReference('');
    setLines([]);
    setVerifiedLines([]);
    setConfirmed(false);
  };

  const getProductName = (productId: string) =>
    inventory.find((i) => i.productId === productId)?.productName ?? productId;

  if (confirmed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Receive Delivery</h1>
          <p className="text-muted-foreground text-sm mt-1">Stock intake confirmed. Levels updated.</p>
        </div>
        <div className="glass-card p-8 text-center rounded-xl">
          <CheckCircle className="w-12 h-12 mx-auto text-green-600 dark:text-green-400 mb-3" />
          <p className="text-foreground font-medium">Stock intake complete</p>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier: {supplier} · Invoice: {invoiceNumber} · Ref: {deliveryReference}
          </p>
          <Button variant="outline" onClick={startNewDelivery} className="mt-4">
            Receive another delivery
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Receive Delivery</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Follow the steps: delivery details → capture expected items → physical verification → confirm. Stock only increases after you confirm.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3, 4] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-medium ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : step > s
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </span>
            {s < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1 – Delivery arrives */}
      {step === 1 && (
        <div className="glass-card p-6 max-w-md space-y-4 rounded-xl">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Truck className="h-5 w-5" />
            Step 1 – Delivery details
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={supplier} onValueChange={setSupplier} required>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice">Invoice number</Label>
            <Input
              id="invoice"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryRef">Delivery reference</Label>
            <Input
              id="deliveryRef"
              value={deliveryReference}
              onChange={(e) => setDeliveryReference(e.target.value)}
              placeholder="e.g. DEL-2026-001"
            />
          </div>
          <Button onClick={goToStep2} disabled={!canProceedStep1}>
            Next: Capture expected items
          </Button>
        </div>
      )}

      {/* Step 2 – Capture expected items (no stock increase yet) */}
      {step === 2 && (
        <div className="glass-card p-6 space-y-4 rounded-xl">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <ClipboardList className="h-5 w-5" />
            Step 2 – Capture expected items (stock not updated yet)
          </div>
          <p className="text-sm text-muted-foreground">
            Supplier: {supplier} · Invoice: {invoiceNumber} · Ref: {deliveryReference}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((i) => (
                    <SelectItem key={i.productId} value={i.productId}>{i.productName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qty delivered</Label>
              <Input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={addCostPrice}
                onChange={(e) => setAddCostPrice(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-2">
              <Label>Batch / lot (optional)</Label>
              <Input value={addBatch} onChange={(e) => setAddBatch(e.target.value)} placeholder="—" />
            </div>
            <div className="space-y-2">
              <Label>Delivery date</Label>
              <Input
                type="date"
                value={addDeliveryDate}
                onChange={(e) => setAddDeliveryDate(e.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" />
              Add line
            </Button>
          </div>

          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Qty</th>
                    <th className="text-left p-3">Cost</th>
                    <th className="text-left p-3">Batch</th>
                    <th className="text-left p-3">Date</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-3">{getProductName(l.productId)}</td>
                      <td className="p-3">{l.quantity}</td>
                      <td className="p-3">{l.costPrice ?? '—'}</td>
                      <td className="p-3">{l.batchNumber ?? '—'}</td>
                      <td className="p-3">{l.deliveryDate}</td>
                      <td className="p-3">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(l.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={goToStep3} disabled={!canProceedStep2}>
              Next: Physical verification
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 – Physical verification */}
      {step === 3 && (
        <div className="glass-card p-6 space-y-4 rounded-xl">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <CheckCircle className="h-5 w-5" />
            Step 3 – Physical verification
          </div>
          <p className="text-sm text-muted-foreground">
            Count items and compare with invoice. If quantities differ, enter actual count and reason.
          </p>

          <div className="space-y-2">
            <Label>Receive into</Label>
            <Select value={location} onValueChange={(v) => setLocation(v as StockLocation)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="lounge">Lounge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Item</th>
                  <th className="text-left p-3">Expected</th>
                  <th className="text-left p-3">Actual count</th>
                  <th className="text-left p-3">Discrepancy reason</th>
                </tr>
              </thead>
              <tbody>
                {verifiedLines.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3">{getProductName(l.productId)}</td>
                    <td className="p-3">{l.quantity}</td>
                    <td className="p-3">
                      <Input
                        type="number"
                        min={0}
                        className="w-24"
                        value={l.actualQuantity}
                        onChange={(e) => setActualQty(l.id, parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td className="p-3">
                      <Select
                        value={l.actualQuantity !== l.quantity ? (l.discrepancyReason ?? '') : ''}
                        onValueChange={(v) => setDiscrepancyReason(l.id, v as (typeof DISCREPANCY_REASONS)[number])}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Reason if mismatch" />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCREPANCY_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)} disabled={!canProceedStep3}>
              Next: Confirm intake
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 – Confirm Stock Intake */}
      {step === 4 && (
        <div className="glass-card p-6 space-y-4 rounded-xl">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <PackagePlus className="h-5 w-5" />
            Step 4 – Confirm Stock Intake
          </div>
          <p className="text-sm text-muted-foreground">
            Click below to increase stock levels. This will be logged (supplier, invoice, manager, date). You cannot edit or delete this intake after confirmation.
          </p>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Item</th>
                  <th className="text-left p-3">Qty to receive</th>
                  <th className="text-left p-3">Into</th>
                </tr>
              </thead>
              <tbody>
                {verifiedLines.filter((l) => l.actualQuantity > 0).map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3">{getProductName(l.productId)}</td>
                    <td className="p-3">{l.actualQuantity}</td>
                    <td className="p-3">{location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={confirmIntake}>
              <PackagePlus className="h-4 w-4 mr-2" />
              Confirm Stock Intake
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
