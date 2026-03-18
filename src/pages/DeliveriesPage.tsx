import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, FileText, Upload, Truck, Boxes, Warehouse, Building2 } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from 'sonner';

interface Delivery {
  id: string;
  date: string;
  supplier: string;
  poRef: string;
  status: 'pending' | 'received' | 'partial';
  invoiceRef?: string;
  invoiceFileName?: string;
  podFileName?: string;
}

const initialDeliveries: Delivery[] = [
  { id: '1', date: '2026-02-26', supplier: 'SA Breweries', poRef: 'PO-102', status: 'received', invoiceRef: 'INV-2026-089' },
  { id: '2', date: '2026-02-25', supplier: 'Distell', poRef: 'PO-101', status: 'received', invoiceRef: 'INV-2026-088' },
  { id: '3', date: '2026-02-24', supplier: 'Coca-Cola', poRef: 'PO-100', status: 'partial' },
];

const supplierOptions = ['SA Breweries', 'Distell Group', 'Pernod Ricard SA', 'Coca-Cola Beverages'];

export default function DeliveriesPage() {
  const { inventory } = useInventory();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);

  const [recordPoRef, setRecordPoRef] = useState('');
  const [recordSupplier, setRecordSupplier] = useState('');
  const [recordInvoiceRef, setRecordInvoiceRef] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [podFile, setPodFile] = useState<File | null>(null);

  const lowStockThreshold = 10;
  const loungeValue = inventory.reduce((sum, i) => sum + i.loungeQty * i.costPrice, 0);
  const warehouseValue = inventory.reduce((sum, i) => sum + i.warehouseQty * i.costPrice, 0);
  const loungeLow = inventory.filter((i) => i.loungeQty < lowStockThreshold).length;
  const warehouseLow = inventory.filter((i) => i.warehouseQty < lowStockThreshold).length;

  const filtered =
    statusFilter === 'all'
      ? deliveries
      : deliveries.filter((d) => d.status === statusFilter);

  const handleRecordDelivery = () => {
    if (!recordPoRef.trim() || !recordSupplier.trim()) {
      toast.error('Enter PO ref and supplier.');
      return;
    }
    const newDelivery: Delivery = {
      id: `d-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      supplier: recordSupplier,
      poRef: recordPoRef,
      status: 'pending',
      invoiceRef: recordInvoiceRef || undefined,
      invoiceFileName: invoiceFile?.name,
      podFileName: podFile?.name,
    };
    setDeliveries((prev) => [newDelivery, ...prev]);
    setRecordPoRef('');
    setRecordSupplier('');
    setRecordInvoiceRef('');
    setInvoiceFile(null);
    setPodFile(null);
    toast.success('Delivery recorded. Invoice and POD attached.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Deliveries & Invoices
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Place orders, upload invoices and proof of delivery (POD), and see what’s happening in the lounge and warehouse.
        </p>
      </div>

      {/* Lounge & warehouse overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-5 w-5" />
            Lounge & warehouse overview
          </CardTitle>
          <CardDescription>
            Current stock value and low-stock counts by location.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Building2 className="h-4 w-4" />
                Lounge
              </div>
              <p className="text-xl font-bold text-foreground mt-1">R{loungeValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loungeLow} item{loungeLow !== 1 ? 's' : ''} below threshold
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Warehouse className="h-4 w-4" />
                Warehouse
              </div>
              <p className="text-xl font-bold text-foreground mt-1">R{warehouseValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {warehouseLow} item{warehouseLow !== 1 ? 's' : ''} below threshold
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/inventory">View full inventory</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild className="gap-2">
          <Link to="/suppliers/purchase-orders">
            <FileText className="h-4 w-4" />
            Place order
          </Link>
        </Button>
        <Button variant="outline" asChild className="gap-2">
          <Link to="/ops/receive-stock">
            <Truck className="h-4 w-4" />
            Receive delivery
          </Link>
        </Button>
      </div>

      {/* Record delivery – upload Invoice & POD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5" />
            Record delivery (upload Invoice & POD)
          </CardTitle>
          <CardDescription>
            Link a delivery to a PO and attach invoice and proof of delivery. These are stored for audit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="poRef">PO reference</Label>
              <Input
                id="poRef"
                placeholder="e.g. PO-103"
                value={recordPoRef}
                onChange={(e) => setRecordPoRef(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={recordSupplier} onValueChange={setRecordSupplier}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {supplierOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceRef">Invoice number (optional)</Label>
            <Input
              id="invoiceRef"
              placeholder="e.g. INV-2026-090"
              value={recordInvoiceRef}
              onChange={(e) => setRecordInvoiceRef(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice (file)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              {invoiceFile && <p className="text-xs text-muted-foreground">{invoiceFile.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Proof of delivery – POD (file)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setPodFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              {podFile && <p className="text-xs text-muted-foreground">{podFile.name}</p>}
            </div>
          </div>
          <Button onClick={handleRecordDelivery} className="gap-2">
            <Upload className="h-4 w-4" />
            Record delivery
          </Button>
        </CardContent>
      </Card>

      {/* Deliveries table */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Delivery history</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Supplier</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">PO Ref</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Invoice / POD</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 text-foreground">{d.date}</td>
                <td className="px-5 py-3 font-medium text-foreground">{d.supplier}</td>
                <td className="px-5 py-3 text-muted-foreground">{d.poRef}</td>
                <td className="px-5 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">
                    {d.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted-foreground flex flex-col gap-0.5">
                  {d.invoiceRef && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> {d.invoiceRef}
                    </span>
                  )}
                  {d.invoiceFileName && (
                    <span className="text-xs">Invoice: {d.invoiceFileName}</span>
                  )}
                  {d.podFileName && (
                    <span className="text-xs">POD: {d.podFileName}</span>
                  )}
                  {!d.invoiceRef && !d.invoiceFileName && !d.podFileName && '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
