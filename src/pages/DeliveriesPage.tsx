import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, FileText, Upload, Truck, Boxes, Warehouse, Building2, Loader2, ExternalLink } from 'lucide-react';
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
import { getSupplierNames } from '@/lib/suppliers-store';
import { toast } from 'sonner';
import { validateUploadFile } from '@/lib/file-upload';
import {
  createDeliveryRecord,
  fetchDeliveries,
  getDeliveryDocumentUrl,
  type DeliveryRecord,
} from '@/lib/deliveries-api';

export default function DeliveriesPage() {
  const { inventory } = useInventory();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const supplierOptions = getSupplierNames();

  const [recordPoRef, setRecordPoRef] = useState('');
  const [recordSupplier, setRecordSupplier] = useState('');
  const [recordInvoiceRef, setRecordInvoiceRef] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [podFile, setPodFile] = useState<File | null>(null);

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchDeliveries();
      setDeliveries(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load deliveries');
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const lowStockThreshold = 10;
  const loungeValue = inventory.reduce((sum, i) => sum + i.loungeQty * i.costPrice, 0);
  const warehouseValue = inventory.reduce((sum, i) => sum + i.warehouseQty * i.costPrice, 0);
  const loungeLow = inventory.filter((i) => i.loungeQty < lowStockThreshold).length;
  const warehouseLow = inventory.filter((i) => i.warehouseQty < lowStockThreshold).length;

  const filtered =
    statusFilter === 'all'
      ? deliveries
      : deliveries.filter((d) => d.status === statusFilter);

  const handleRecordDelivery = async () => {
    if (uploading) return;
    if (!recordPoRef.trim() || !recordSupplier.trim()) {
      toast.error('Enter PO ref and supplier.');
      return;
    }
    const invoiceCheck = validateUploadFile(invoiceFile, 'Invoice');
    if (!invoiceCheck.ok) {
      toast.error(invoiceCheck.message);
      return;
    }
    const podCheck = validateUploadFile(podFile, 'Proof of delivery');
    if (!podCheck.ok) {
      toast.error(podCheck.message);
      return;
    }

    setUploading(true);
    try {
      await createDeliveryRecord({
        poRef: recordPoRef.trim(),
        supplier: recordSupplier.trim(),
        invoiceRef: recordInvoiceRef.trim() || undefined,
        invoiceFile: invoiceFile!,
        podFile: podFile!,
      });
      setRecordPoRef('');
      setRecordSupplier('');
      setRecordInvoiceRef('');
      setInvoiceFile(null);
      setPodFile(null);
      toast.success('Delivery recorded. Invoice and POD uploaded successfully.');
      await loadDeliveries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record delivery');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (recordId: string, type: 'invoice' | 'pod') => {
    try {
      const { url } = await getDeliveryDocumentUrl(recordId, type);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to open document');
    }
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
          Place orders, upload invoices and proof of delivery (POD), and see what's happening in the lounge and warehouse.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5" />
            Record delivery (upload Invoice & POD)
          </CardTitle>
          <CardDescription>
            Link a delivery to a PO and attach invoice and proof of delivery. Files are stored securely for audit.
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
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              {supplierOptions.length > 0 ? (
                <Select value={recordSupplier} onValueChange={setRecordSupplier} disabled={uploading}>
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="supplier"
                  value={recordSupplier}
                  onChange={(e) => setRecordSupplier(e.target.value)}
                  placeholder="Supplier name"
                  disabled={uploading}
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceRef">Invoice number (optional)</Label>
            <Input
              id="invoiceRef"
              placeholder="e.g. INV-2026-090"
              value={recordInvoiceRef}
              onChange={(e) => setRecordInvoiceRef(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice (file, required)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
                disabled={uploading}
              />
              {invoiceFile && <p className="text-xs text-muted-foreground">{invoiceFile.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Proof of delivery – POD (file, required)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setPodFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
                disabled={uploading}
              />
              {podFile && <p className="text-xs text-muted-foreground">{podFile.name}</p>}
            </div>
          </div>
          <Button onClick={handleRecordDelivery} className="gap-2" disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Record delivery
              </>
            )}
          </Button>
        </CardContent>
      </Card>

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
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Loading deliveries…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No deliveries recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-5 py-3 text-foreground">
                    {new Date(d.createdAt).toLocaleDateString('en-ZA')}
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{d.supplier}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.poRef}</td>
                  <td className="px-5 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {d.invoiceRef && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> {d.invoiceRef}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {d.hasInvoice && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => handleViewDocument(d.id, 'invoice')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {d.invoiceFileName || 'Invoice'}
                        </Button>
                      )}
                      {d.hasPod && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => handleViewDocument(d.id, 'pod')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {d.podFileName || 'POD'}
                        </Button>
                      )}
                      {!d.hasInvoice && !d.hasPod && !d.invoiceRef && '—'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
