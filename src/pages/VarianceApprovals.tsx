import { usePurchaseOrders } from '@/contexts/PurchaseOrderContext';
import { FileText, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';

export default function VarianceApprovals() {
  const { orders, approveVariance, rejectVariance } = usePurchaseOrders();
  const pending = orders.filter((o) => o.hasVariance && o.varianceApprovalStatus === 'pending');

  const handleApprove = (poId: string) => {
    approveVariance(poId);
    toast.success('Variance approved. Stock posted to Warehouse.');
  };

  const handleReject = (poId: string) => {
    rejectVariance(poId);
    toast.error('Variance rejected.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Variance cases</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          POs with delivery variance require owner approval before stock is posted to Warehouse. Review order vs delivered quantities and Approve or Reject.
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        {pending.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground">
            No pending variance cases.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pending.map((po) => (
              <div key={po.id} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{po.id} — {po.supplierName}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Received: {po.receivedAt ? new Date(po.receivedAt).toLocaleString('en-ZA') : '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1" onClick={() => handleApprove(po.id)}>
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleReject(po.id)}>
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground mb-2">Order vs delivered (variance)</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium text-muted-foreground">Product</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Ordered</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Delivered</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((item) => {
                        const delivered = item.deliveredQty ?? 0;
                        const variance = delivered - item.orderedQty;
                        return (
                          <tr key={item.productId} className="border-b border-border/50">
                            <td className="py-2 text-foreground">{item.productName}</td>
                            <td className="py-2 text-right text-muted-foreground">{item.orderedQty}</td>
                            <td className="py-2 text-right text-muted-foreground">{delivered}</td>
                            <td className={`py-2 text-right font-medium ${variance !== 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                              {variance > 0 ? '+' : ''}{variance}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
