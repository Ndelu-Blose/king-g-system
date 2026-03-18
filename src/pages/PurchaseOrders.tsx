import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Send, Truck } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  usePurchaseOrders,
  poProductList,
  type PurchaseOrder,
  type POLineItem,
} from '@/contexts/PurchaseOrderContext';
const statusColors: Record<PurchaseOrder['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  received: 'bg-success/10 text-success',
};

const approvalColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

const supplierOptions = ['SA Breweries', 'Distell Group', 'Pernod Ricard SA', 'Coca-Cola Beverages'];

export default function PurchaseOrdersPage() {
  const {
    orders,
    addOrder,
    updateOrderItems,
    sendPO,
    receiveDelivery,
    getOrder,
  } = usePurchaseOrders();
  const [createStep, setCreateStep] = useState<'supplier' | 'items'>('supplier');
  const [createSupplier, setCreateSupplier] = useState('');
  const [newPoId, setNewPoId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<POLineItem[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addCost, setAddCost] = useState('');
  const [expandId, setExpandId] = useState<string | null>(null);
  const [receivePoId, setReceivePoId] = useState<string | null>(null);
  const [deliveryInvoiceUrl, setDeliveryInvoiceUrl] = useState('');
  const [deliveredQtys, setDeliveredQtys] = useState<Record<string, string>>({});

  const handleStartCreate = () => {
    setCreateStep('supplier');
    setCreateSupplier('');
    setNewPoId(null);
    setDraftItems([]);
  };

  const handleCreateNext = () => {
    if (!createSupplier.trim()) {
      toast.error('Select a supplier.');
      return;
    }
    const po = addOrder(`s-${Date.now()}`, createSupplier);
    setNewPoId(po.id);
    setCreateStep('items');
  };

  const handleAddLineItem = () => {
    const product = poProductList.find((p) => p.id === addProductId);
    if (!product) {
      toast.error('Select a product.');
      return;
    }
    const qty = parseInt(addQty, 10);
    const cost = parseFloat(addCost);
    if (!Number.isInteger(qty) || qty <= 0 || Number.isNaN(cost) || cost < 0) {
      toast.error('Enter valid quantity and unit cost.');
      return;
    }
    const existing = draftItems.find((i) => i.productId === product.id);
    const newItems = existing
      ? draftItems.map((i) =>
          i.productId === product.id
            ? { ...i, orderedQty: i.orderedQty + qty, expectedUnitCost: cost }
            : i
        )
      : [...draftItems, { productId: product.id, productName: product.name, orderedQty: qty, expectedUnitCost: cost }];
    setDraftItems(newItems);
    setAddProductId('');
    setAddQty('');
    setAddCost('');
  };

  const handleRemoveLineItem = (productId: string) => {
    setDraftItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleSaveDraft = () => {
    if (!newPoId) return;
    updateOrderItems(newPoId, draftItems);
    toast.success('Draft saved.');
    setCreateStep('supplier');
    setNewPoId(null);
    setDraftItems([]);
    setCreatePoOpen(false);
  };

  const [createPoOpen, setCreatePoOpen] = useState(false);
  const openCreatePo = () => {
    handleStartCreate();
    setCreatePoOpen(true);
  };

  const handleSendPo = (poId: string) => {
    const po = getOrder(poId);
    if (!po || po.items.length === 0) {
      toast.error('Add at least one line item before sending.');
      return;
    }
    sendPO(poId);
    toast.success(`${poId} sent to supplier.`);
  };

  const openReceive = (po: PurchaseOrder) => {
    setReceivePoId(po.id);
    setDeliveryInvoiceUrl('');
    const qtyMap: Record<string, string> = {};
    po.items.forEach((i) => (qtyMap[i.productId] = String(i.orderedQty)));
    setDeliveredQtys(qtyMap);
  };

  const handleReceiveSubmit = () => {
    if (!receivePoId) return;
    const numeric: Record<string, number> = {};
    Object.entries(deliveredQtys).forEach(([id, v]) => (numeric[id] = parseInt(v, 10) || 0));
    const { hasVariance } = receiveDelivery(receivePoId, deliveryInvoiceUrl || '—', numeric);
    setReceivePoId(null);
    if (hasVariance) {
      toast.warning('Variance detected. Owner approval required before stock is posted.');
    } else {
      toast.success('Delivery received. Stock posted to Warehouse.');
    }
  };

  const outstanding = (po: PurchaseOrder) => {
    if (po.status !== 'received' || !po.items.length) return '—';
    const sumOrdered = po.items.reduce((s, i) => s + i.orderedQty, 0);
    const sumDelivered = po.items.reduce((s, i) => s + (i.deliveredQty ?? 0), 0);
    return `${sumDelivered}/${sumOrdered} units`;
  };

  const receivedYesNo = (po: PurchaseOrder) => (po.status === 'received' ? 'Yes' : 'No');
  const varianceBadge = (po: PurchaseOrder) =>
    po.hasVariance ? (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">Variance</span>
    ) : (
      '—'
    );
  const approvalBadge = (po: PurchaseOrder) =>
    po.varianceApprovalStatus ? (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${approvalColors[po.varianceApprovalStatus] ?? ''}`}>
        {po.varianceApprovalStatus}
      </span>
    ) : (
      '—'
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/suppliers" label="Back to Suppliers" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Purchase orders</h1>
          </div>
          <p className="text-sm text-muted-foreground">View and create purchase orders. Receive delivery and handle variances.</p>
        </div>
        <Button onClick={openCreatePo} className="gap-2 gold-gradient text-primary-foreground">
          <Plus className="w-4 h-4" />
          Create PO
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">PO #</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Supplier</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Outstanding</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Variance</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Received?</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Approval</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <Fragment key={po.id}>
                <tr
                  className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                  onClick={() => setExpandId(expandId === po.id ? null : po.id)}
                >
                  <td className="px-5 py-3 font-medium text-foreground">{po.id}</td>
                  <td className="px-5 py-3 text-muted-foreground">{po.supplierName}</td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">R{po.total.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[po.status]}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{outstanding(po)}</td>
                  <td className="px-5 py-3">{varianceBadge(po)}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{receivedYesNo(po)}</td>
                  <td className="px-5 py-3">{approvalBadge(po)}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {new Date(po.createdAt).toLocaleDateString('en-ZA', { dateStyle: 'short' })}
                  </td>
                  <td className="px-5 py-3" />
                </tr>
                {expandId === po.id && (
                  <tr className="bg-muted/10">
                    <td colSpan={10} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-sm">
                          <p className="font-medium text-muted-foreground mb-2">Line items</p>
                          <ul className="space-y-1">
                            {po.items.map((item) => (
                              <li key={item.productId} className="flex justify-between gap-4">
                                <span>
                                  {item.productName} × {item.orderedQty}
                                  {item.deliveredQty !== undefined && (
                                    <span className="text-muted-foreground ml-1">
                                      (delivered: {item.deliveredQty})
                                    </span>
                                  )}
                                </span>
                                <span>R{(item.orderedQty * item.expectedUnitCost).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {po.status === 'draft' && po.items.length > 0 && (
                          <Button size="sm" onClick={() => handleSendPo(po.id)} className="gap-1">
                            <Send className="w-3.5 h-3.5" />
                            Send PO
                          </Button>
                        )}
                        {po.status === 'sent' && (
                          <Button size="sm" variant="secondary" onClick={() => openReceive(po)} className="gap-1">
                            <Truck className="w-3.5 h-3.5" />
                            Receive Delivery
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create PO dialog */}
      <Dialog open={createPoOpen} onOpenChange={setCreatePoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{createStep === 'supplier' ? 'Create PO — Select supplier' : `Create PO — Add items (${newPoId})`}</DialogTitle>
          </DialogHeader>
          {createStep === 'supplier' ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={createSupplier} onValueChange={setCreateSupplier}>
                  <SelectTrigger>
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
          ) : (
            <div className="grid gap-4 py-2">
              <div className="flex gap-2 flex-wrap items-end">
                <div className="grid gap-1">
                  <Label>Product</Label>
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {poProductList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="w-20"
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-1">
                  <Label>Unit cost (R)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addCost}
                    onChange={(e) => setAddCost(e.target.value)}
                    className="w-24"
                    placeholder="0"
                  />
                </div>
                <Button size="sm" onClick={handleAddLineItem}>Add line</Button>
              </div>
              {draftItems.length > 0 && (
                <div className="border rounded-lg p-3 text-sm">
                  <p className="font-medium text-muted-foreground mb-2">Items in this PO</p>
                  <ul className="space-y-1">
                    {draftItems.map((i) => (
                      <li key={i.productId} className="flex justify-between items-center">
                        <span>{i.productName} × {i.orderedQty} @ R{i.expectedUnitCost}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleRemoveLineItem(i.productId)}>Remove</Button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold">Total: R{draftItems.reduce((s, i) => s + i.orderedQty * i.expectedUnitCost, 0).toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {createStep === 'supplier' ? (
              <>
                <Button variant="outline" onClick={() => setCreatePoOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateNext}>Next — Add products</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateStep('supplier')}>Back</Button>
                <Button variant="outline" onClick={handleSaveDraft}>Save as draft</Button>
                <Button
                  onClick={() => {
                    if (newPoId) updateOrderItems(newPoId, draftItems);
                    toast.success('Draft saved.');
                    setCreatePoOpen(false);
                    setCreateStep('supplier');
                    setNewPoId(null);
                    setDraftItems([]);
                  }}
                >
                  Save & close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Delivery dialog */}
      <Dialog open={!!receivePoId} onOpenChange={(open) => !open && setReceivePoId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receive delivery</DialogTitle>
          </DialogHeader>
          {receivePoId && (() => {
            const po = getOrder(receivePoId);
            if (!po) return null;
            return (
              <div className="grid gap-4 py-2">
                <p className="text-sm text-muted-foreground">{po.id} — {po.supplierName}</p>
                <div className="grid gap-2">
                  <Label>Delivery invoice (URL or reference)</Label>
                  <Input
                    value={deliveryInvoiceUrl}
                    onChange={(e) => setDeliveryInvoiceUrl(e.target.value)}
                    placeholder="e.g. INV-2026-001 or paste URL"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Delivered quantities (actual count)</Label>
                  {po.items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2">
                      <span className="text-sm w-40 truncate">{item.productName}</span>
                      <span className="text-xs text-muted-foreground">ordered: {item.orderedQty}</span>
                      <Input
                        type="number"
                        min={0}
                        value={deliveredQtys[item.productId] ?? ''}
                        onChange={(e) => setDeliveredQtys((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                        className="w-20"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivePoId(null)}>Cancel</Button>
            <Button onClick={handleReceiveSubmit}>Submit delivery</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
