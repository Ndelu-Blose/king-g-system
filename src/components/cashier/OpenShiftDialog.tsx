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
import { toast } from 'sonner';
import { useShift } from '@/contexts/ShiftContext';
import { Clock } from 'lucide-react';

interface OpenShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenShiftDialog({ open, onOpenChange }: OpenShiftDialogProps) {
  const { isOpen, openedAt, openShift } = useShift();
  const [justOpened, setJustOpened] = useState(false);

  const handleOpenShift = () => {
    openShift();
    const time = new Date().toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setJustOpened(true);
    toast.success(`Shift opened at ${time}`);
  };

  const handleClose = () => {
    setJustOpened(false);
    onOpenChange(false);
  };

  const openedTime =
    openedAt &&
    new Date(openedAt).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  const openedDate =
    openedAt &&
    new Date(openedAt).toLocaleDateString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Shift</DialogTitle>
          <DialogDescription>
            {isOpen || justOpened
              ? 'Your shift is in progress. You can process sales and view Sales History.'
              : 'Start your shift. You will be able to process sales and view your sales history for this shift.'}
          </DialogDescription>
        </DialogHeader>

        {(isOpen || justOpened) && (openedAt || justOpened) && (
          <div className="flex items-center gap-3 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                Shift opened {justOpened ? 'now' : `at ${openedTime}`}
              </p>
              {openedDate && !justOpened && (
                <p className="text-sm text-muted-foreground">{openedDate}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {isOpen && !justOpened ? 'Close' : 'Cancel'}
          </Button>
          {!isOpen && !justOpened ? (
            <Button onClick={handleOpenShift}>Open Shift</Button>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
