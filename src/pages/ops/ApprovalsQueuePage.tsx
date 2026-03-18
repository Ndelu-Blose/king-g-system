import { useState } from 'react';
import { ListChecks, Package, Receipt, Ban } from 'lucide-react';
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
import RefundApprovals from '@/pages/RefundApprovals';
import VoidTransactions from '@/pages/VoidTransactions';
import { BackButton } from '@/components/BackButton';

// Mock pending item removals (pre-payment cart adjustments needing manager approval)
const MOCK_REMOVAL_REASONS = [
  'Payment Declined',
  'Customer Changed Mind',
  'Pricing Clarification',
  'Wrong Item Scanned',
];

const mockPendingRemovals = [
  {
    id: 'REM-001',
    txnId: 'TXN-LIVE-01',
    cashierId: '4',
    cashierName: 'Sipho N.',
    removedItem: 'Johnnie Walker Black',
    itemValue: 450,
    reason: 'Payment Declined',
    requestedAt: '2026-03-02T14:32:00',
    terminalId: 'T1',
  },
  {
    id: 'REM-002',
    txnId: 'TXN-LIVE-02',
    cashierId: '4',
    cashierName: 'Sipho N.',
    removedItem: 'Moët & Chandon',
    itemValue: 1200,
    reason: 'Customer Changed Mind',
    requestedAt: '2026-03-02T15:10:00',
    terminalId: 'T1',
  },
];

export default function ApprovalsQueuePage() {
  const [activeTab, setActiveTab] = useState<'removals' | 'refunds' | 'voids'>('removals');
  const [pendingRemovals, setPendingRemovals] = useState(mockPendingRemovals);
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    removal: (typeof mockPendingRemovals)[0] | null;
    pin: string;
    reason: string;
  }>({ open: false, removal: null, pin: '', reason: '' });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });

  const handleRequestApproval = (removal: (typeof mockPendingRemovals)[0]) => {
    setApprovalDialog({ open: true, removal, pin: '', reason: MOCK_REMOVAL_REASONS[0] });
  };

  const handleConfirmApproval = () => {
    const { removal, pin, reason } = approvalDialog;
    if (!removal) return;
    if (!pin.trim()) {
      toast.error('Enter your PIN to approve.');
      return;
    }
    setPendingRemovals((prev) => prev.filter((r) => r.id !== removal.id));
    setApprovalDialog({ open: false, removal: null, pin: '', reason: '' });
    toast.success(`Item removal approved. Logged: ${removal.removedItem} — ${reason}`);
  };

  const handleRejectRemoval = (id: string) => {
    setPendingRemovals((prev) => prev.filter((r) => r.id !== id));
    toast.error('Removal rejected.');
  };

  const tabs = [
    { id: 'removals' as const, label: 'Item removals', icon: Package, count: pendingRemovals.length },
    { id: 'refunds' as const, label: 'Refunds', icon: Receipt },
    { id: 'voids' as const, label: 'Voids', icon: Ban },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <ListChecks className="w-7 h-7 text-primary" />
          Approvals Queue
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Approve or reject item removals (pre-payment), refunds, and voids. <strong>Refunds are issued here</strong> when you approve (with PIN). Voids require your PIN to authorize. All actions are logged with your ID and timestamp.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-background/30">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'removals' && (
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">Pending item removals</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pre-payment cart adjustments that need manager approval (e.g. high value, or payment declined).
            </p>
          </div>
          {pendingRemovals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No pending item removals. When a cashier removes an item that requires approval, it will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Transaction</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Cashier</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Removed item</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Value</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Reason</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Time</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRemovals.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium text-foreground">{r.txnId}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{r.cashierName}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{r.removedItem}</td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground">R{r.itemValue.toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{r.reason}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatTime(r.requestedAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="default" onClick={() => handleRequestApproval(r)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectRemoval(r.id)}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'refunds' && (
        <div className="space-y-4">
          <RefundApprovals hideTitle />
        </div>
      )}

      {activeTab === 'voids' && (
        <div className="space-y-4">
          <VoidTransactions hideTitle />
        </div>
      )}

      <Dialog open={approvalDialog.open} onOpenChange={(open) => !open && setApprovalDialog((p) => ({ ...p, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve item removal</DialogTitle>
          </DialogHeader>
          {approvalDialog.removal && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                <strong>{approvalDialog.removal.removedItem}</strong> — R{approvalDialog.removal.itemValue.toFixed(2)} · {approvalDialog.removal.reason}
              </p>
              <div className="space-y-2">
                <Label>Your PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Manager PIN"
                  value={approvalDialog.pin}
                  onChange={(e) => setApprovalDialog((p) => ({ ...p, pin: e.target.value }))}
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason (logged)</Label>
                <Select
                  value={approvalDialog.reason}
                  onValueChange={(v) => setApprovalDialog((p) => ({ ...p, reason: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_REMOVAL_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button onClick={handleConfirmApproval}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
