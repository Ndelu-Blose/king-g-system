import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { createHelpRequest } from '@/lib/pos-api';

interface HelpSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpSupportDialog({ open, onOpenChange }: HelpSupportDialogProps) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const handleCallManager = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to request help.');
      return;
    }
    setSending(true);
    try {
      await createHelpRequest({
        cashierId: user.id,
        cashierName: user.name ?? undefined,
        message: 'Cashier requested manager assistance at terminal.',
      });
      toast.success('Manager has been notified. They will assist you shortly.');
      onOpenChange(false);
    } catch (e) {
      toast.error('Something went wrong. Please try again or find a manager.');
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help & Support</DialogTitle>
          <DialogDescription>
            Need assistance? Request a manager to come to your terminal. They will be notified and can help with refunds, voids, or any issues.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCallManager} className="gap-2" disabled={sending}>
            <Phone className="h-4 w-4" />
            {sending ? 'Sending…' : 'Call Manager'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
