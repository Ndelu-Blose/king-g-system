import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface AuthorizeVoidDialogTransaction {
  id: string;
  total: number;
}

interface AuthorizeVoidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: AuthorizeVoidDialogTransaction | null;
  onConfirm: (pin: string, reason: string) => void;
}

export function AuthorizeVoidDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
}: AuthorizeVoidDialogProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');

  const handleClose = () => {
    setPin('');
    setReason('');
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!transaction) return;
    onConfirm(pin, reason);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Authorize void</DialogTitle>
        </DialogHeader>
        {transaction && (
          <>
            <p className="text-sm text-muted-foreground">
              Void <strong>{transaction.id}</strong> (R{transaction.total})? This cannot be undone.
            </p>
            <div className="space-y-2 py-2">
              <Label>Your PIN (authorization)</Label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Enter supervisor PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate sale, wrong item"
              />
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!pin.trim()}
          >
            Void transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
