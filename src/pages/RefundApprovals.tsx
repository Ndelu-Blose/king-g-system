import { useState } from 'react';
import { Receipt, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { BackButton } from '@/components/BackButton';

const REFUND_THRESHOLD = 500;

const mockPendingRefunds = [
  { id: 'REF-001', txnId: 'TXN-101', amount: 350, reason: 'Customer return - wrong item', requestedBy: 'Sipho N.', requestedAt: '2026-02-20 10:30' },
  { id: 'REF-002', txnId: 'TXN-098', amount: 620, reason: 'Duplicate charge', requestedBy: 'Sipho N.', requestedAt: '2026-02-20 09:15' },
  { id: 'REF-003', txnId: 'TXN-095', amount: 180, reason: 'Defective product', requestedBy: 'Lerato K.', requestedAt: '2026-02-19 16:45' },
];

interface RefundApprovalsProps {
  hideTitle?: boolean;
}

export default function RefundApprovals({ hideTitle }: RefundApprovalsProps) {
  const { user } = useAuth();
  const [pending, setPending] = useState(mockPendingRefunds);
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; refund: (typeof mockPendingRefunds)[0] | null; pin: string }>({
    open: false,
    refund: null,
    pin: '',
  });

  const handleRequestApprove = (refund: (typeof mockPendingRefunds)[0]) => {
    setApproveDialog({ open: true, refund, pin: '' });
  };

  const handleConfirmApprove = () => {
    const { refund, pin } = approveDialog;
    if (!refund) return;
    if (!pin.trim()) {
      toast.error('Enter your PIN to authorize the refund.');
      return;
    }
    setPending((prev) => prev.filter((r) => r.id !== refund.id));
    setApproveDialog({ open: false, refund: null, pin: '' });
    toast.success(`Refund approved and issued. R${refund.amount.toFixed(2)} — authorized by ${user?.name ?? 'manager'}.`);
  };

  const handleReject = (id: string) => {
    setPending((prev) => prev.filter((r) => r.id !== id));
    toast.error('Refund rejected.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      {!hideTitle && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-6 h-6 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Refund approvals</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Refunds above R{REFUND_THRESHOLD} require your approval. Approving here authorizes and <strong>issues the refund</strong>; you must enter your PIN to confirm.
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Refund ID</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Transaction</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Reason</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Requested by</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No pending refunds above threshold.
                </td>
              </tr>
            ) : (
              pending.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium text-foreground">{r.id}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.txnId}</td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">R{r.amount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{r.reason}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{r.requestedBy}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{r.requestedAt}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button size="sm" variant="default" className="gap-1" onClick={() => handleRequestApprove(r)}>
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleReject(r.id)}>
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={approveDialog.open} onOpenChange={(open) => !open && setApproveDialog((p) => ({ ...p, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Authorize refund</DialogTitle>
          </DialogHeader>
          {approveDialog.refund && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Issue refund <strong>R{approveDialog.refund.amount.toFixed(2)}</strong> for {approveDialog.refund.txnId} — {approveDialog.refund.reason}.
              </p>
              <div className="space-y-2">
                <Label>Your PIN (authorization)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter supervisor PIN"
                  value={approveDialog.pin}
                  onChange={(e) => setApproveDialog((p) => ({ ...p, pin: e.target.value }))}
                  maxLength={6}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog((p) => ({ ...p, open: false }))}>Cancel</Button>
            <Button onClick={handleConfirmApprove}>Issue refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
