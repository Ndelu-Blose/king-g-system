import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Plus, FileText } from 'lucide-react';
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
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';
import { addSupplier, getSuppliers, type SupplierRecord } from '@/lib/suppliers-store';

export type Supplier = SupplierRecord;

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(() => getSuppliers());
  const [addOpen, setAddOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', phone: '' });

  const refresh = () => setSuppliers(getSuppliers());

  const handleAddSupplier = () => {
    const name = newSupplier.name.trim();
    const contact = newSupplier.contact.trim();
    const phone = newSupplier.phone.trim();
    if (!name) {
      toast.error('Supplier name is required.');
      return;
    }
    if (!contact) {
      toast.error('Contact email is required.');
      return;
    }
    addSupplier({ name, contact, phone });
    refresh();
    toast.success(`"${name}" added.`);
    setAddOpen(false);
    setNewSupplier({ name: '', contact: '', phone: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage suppliers and purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="gap-2" asChild>
            <Link to="/suppliers/purchase-orders">
              <FileText className="w-4 h-4" />
              Purchase Orders
            </Link>
          </Button>
          <Button
            onClick={() => setAddOpen(true)}
            className="gap-2 gold-gradient text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="glass-card p-10 text-center rounded-xl">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">No suppliers yet. Add your first supplier to create purchase orders.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="glass-card card-hover p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{s.contact}</p>
                  {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs bg-success/10 text-success font-medium capitalize">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="supplier-name">Supplier name</Label>
              <Input
                id="supplier-name"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))}
                placeholder="Supplier name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-contact">Contact email</Label>
              <Input
                id="supplier-contact"
                type="email"
                value={newSupplier.contact}
                onChange={(e) => setNewSupplier((p) => ({ ...p, contact: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSupplier}>Add supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
