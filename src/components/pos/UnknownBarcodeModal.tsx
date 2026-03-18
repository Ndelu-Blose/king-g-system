import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

interface UnknownBarcodeModalProps {
  open: boolean;
  barcode: string;
  onClose: () => void;
  onScanAgain: () => void;
  onSearchAndAdd: () => void;
  onCreateQuickItem?: () => void;
}

export function UnknownBarcodeModal({
  open,
  barcode,
  onClose,
  onScanAgain,
  onSearchAndAdd,
  onCreateQuickItem,
}: UnknownBarcodeModalProps) {
  const { user } = useAuth();
  const isManager =
    user?.role === 'manager' ||
    user?.role === 'senior_manager' ||
    user?.role === 'owner';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={onClose}>
        <DialogHeader>
          <DialogTitle>Item not found</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          No product found for barcode: <code className="px-1.5 py-0.5 rounded bg-secondary font-mono text-foreground">{barcode}</code>
        </p>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onScanAgain} className="w-full sm:w-auto">
            Scan again
          </Button>
          <Button variant="secondary" onClick={onSearchAndAdd} className="w-full sm:w-auto">
            Search & add manually
          </Button>
          {isManager && onCreateQuickItem && (
            <Button onClick={onCreateQuickItem} className="w-full sm:w-auto">
              Create quick item (Manager)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
