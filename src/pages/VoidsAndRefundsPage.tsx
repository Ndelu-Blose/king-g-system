import { Ban, Receipt } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VoidTransactions from '@/pages/VoidTransactions';
import RefundApprovals from '@/pages/RefundApprovals';
import { BackButton } from '@/components/BackButton';

export default function VoidsAndRefundsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Voids & Refunds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Approval history, reasons, and approvers. Manage voids and refund requests in one place.
        </p>
      </div>

      <Tabs defaultValue="voids" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="voids" className="gap-2">
            <Ban className="h-4 w-4" />
            Voids
          </TabsTrigger>
          <TabsTrigger value="refunds" className="gap-2">
            <Receipt className="h-4 w-4" />
            Refunds
          </TabsTrigger>
        </TabsList>
        <TabsContent value="voids" className="mt-6">
          <VoidTransactions hideTitle />
        </TabsContent>
        <TabsContent value="refunds" className="mt-6">
          <RefundApprovals hideTitle />
        </TabsContent>
      </Tabs>
    </div>
  );
}
