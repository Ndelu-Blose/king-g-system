import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { mockProducts as initialMockProducts } from '@/lib/mock-data';
import type { Product } from '@/lib/mock-data';
import { useHappyHour } from '@/contexts/HappyHourContext';
import { Search, Plus, Edit, Package, Percent, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';

const CATEGORY_OPTIONS = ['Whisky', 'Cognac', 'Champagne', 'Vodka', 'Gin', 'Tequila', 'Beer', 'Liqueur', 'Mixers', 'Other'];

export default function Products() {
  const [products, setProducts] = useState<Product[]>(initialMockProducts);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const {
    discountPercent,
    setDiscountPercent,
    productDiscounts,
    setProductDiscount,
    getDiscountForProduct,
    getEffectivePrice,
    isActive,
    applyGlobalToAllProducts,
    clearAllProductDiscounts,
  } = useHappyHour();
  const [percentInput, setPercentInput] = useState(String(discountPercent));
  const [editProduct, setEditProduct] = useState<{ id: string; name: string } | null>(null);
  const [editPercent, setEditPercent] = useState('');
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    category: 'Whisky',
    costPrice: '',
    basePrice: '',
  });
  const [editFullProduct, setEditFullProduct] = useState<Product | null>(null);
  const [editFullForm, setEditFullForm] = useState({ name: '', barcode: '', category: 'Whisky', costPrice: '', basePrice: '' });
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const isManager =
    user?.role === 'manager' ||
    user?.role === 'senior_manager' ||
    user?.role === 'owner';
  const canEditDeleteProduct = user?.role === 'senior_manager' || user?.role === 'owner';

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleApplyHappyHour = () => {
    const n = parseFloat(percentInput);
    if (!Number.isNaN(n)) setDiscountPercent(n);
  };

  const handleClearHappyHour = () => {
    setDiscountPercent(0);
    setPercentInput('0');
  };

  const handleApplyToAll = () => {
    const n = parseFloat(percentInput);
    if (!Number.isNaN(n) && n > 0) {
      setDiscountPercent(n);
      applyGlobalToAllProducts(products.map((p) => p.id));
    }
  };

  const openEditDiscount = (product: { id: string; name: string }) => {
    setEditProduct(product);
    const current = productDiscounts[product.id];
    setEditPercent(current !== undefined ? String(current) : '');
  };

  const saveEditDiscount = () => {
    if (!editProduct) return;
    const trimmed = editPercent.trim();
    const n = trimmed === '' ? NaN : parseFloat(trimmed);
    setProductDiscount(editProduct.id, Number.isNaN(n) ? 0 : n);
    setEditProduct(null);
  };

  const handleOpenAddProduct = () => {
    setNewProduct({ name: '', barcode: '', category: 'Whisky', costPrice: '', basePrice: '' });
    setAddProductOpen(true);
  };

  const handleAddProduct = () => {
    const name = newProduct.name.trim();
    const barcode = newProduct.barcode.trim();
    const costNum = parseFloat(newProduct.costPrice);
    const baseNum = parseFloat(newProduct.basePrice);
    if (!name) {
      toast.error('Product name is required.');
      return;
    }
    if (!barcode) {
      toast.error('Barcode is required.');
      return;
    }
    if (products.some((p) => p.barcode === barcode)) {
      toast.error('A product with this barcode already exists.');
      return;
    }
    if (Number.isNaN(costNum) || costNum < 0 || Number.isNaN(baseNum) || baseNum < 0) {
      toast.error('Enter valid cost and price (numbers ≥ 0).');
      return;
    }
    const id = `p-${Date.now()}`;
    setProducts((prev) => [
      ...prev,
      { id, name, barcode, category: newProduct.category, costPrice: costNum, basePrice: baseNum },
    ]);
    toast.success(`"${name}" added.`);
    setAddProductOpen(false);
  };

  const openEditFull = (product: Product) => {
    setEditFullProduct(product);
    setEditFullForm({
      name: product.name,
      barcode: product.barcode,
      category: product.category,
      costPrice: String(product.costPrice),
      basePrice: String(product.basePrice),
    });
  };

  const saveEditFull = () => {
    if (!editFullProduct) return;
    const name = editFullForm.name.trim();
    const barcode = editFullForm.barcode.trim();
    const costNum = parseFloat(editFullForm.costPrice);
    const baseNum = parseFloat(editFullForm.basePrice);
    if (!name) {
      toast.error('Product name is required.');
      return;
    }
    if (!barcode) {
      toast.error('Barcode is required.');
      return;
    }
    const otherWithBarcode = products.find((p) => p.id !== editFullProduct.id && p.barcode === barcode);
    if (otherWithBarcode) {
      toast.error('Another product already uses this barcode.');
      return;
    }
    if (Number.isNaN(costNum) || costNum < 0 || Number.isNaN(baseNum) || baseNum < 0) {
      toast.error('Enter valid cost and price (numbers ≥ 0).');
      return;
    }
    setProducts((prev) =>
      prev.map((p) =>
        p.id === editFullProduct.id
          ? { ...p, name, barcode, category: editFullForm.category, costPrice: costNum, basePrice: baseNum }
          : p
      )
    );
    toast.success(`"${name}" updated.`);
    setEditFullProduct(null);
  };

  const handleDeleteProduct = () => {
    if (!deleteProduct) return;
    setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));
    toast.success(`"${deleteProduct.name}" removed.`);
    setDeleteProduct(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} products registered</p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddProduct}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gold-gradient text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {isManager && (
        <div className="glass-card p-5 border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-foreground">Happy hour pricing</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Set a global discount (applies to products that don’t have their own discount), or set a different discount per product in the table below. Use “Apply to all” to give every product the same % as the global value.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={percentInput}
                onChange={(e) => setPercentInput(e.target.value)}
                onBlur={handleApplyHappyHour}
                placeholder="0"
                className="w-24 h-9"
              />
              <span className="text-sm text-muted-foreground">% off</span>
            </div>
            <Button onClick={handleApplyHappyHour} size="sm">
              Set global
            </Button>
            <Button onClick={handleApplyToAll} size="sm" variant="secondary">
              Apply to all products
            </Button>
            <Button onClick={handleClearHappyHour} variant="outline" size="sm">
              Clear global
            </Button>
            <Button onClick={clearAllProductDiscounts} variant="ghost" size="sm" className="text-muted-foreground">
              Clear per-product only
            </Button>
            {isActive && (
              <span className="text-sm font-medium text-primary">
                Global: {discountPercent}% off
              </span>
            )}
          </div>
          {isActive && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase">Product</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Discount</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Original</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase">Happy hour price</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 8).map((p) => {
                    const discount = getDiscountForProduct(p.id);
                    return (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{p.name}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {discount > 0 ? `${discount}%` : '—'}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">R{p.basePrice}</td>
                        <td className="py-2 text-right font-semibold text-primary">
                          R{getEffectivePrice(p.basePrice, p.id).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {products.length > 8 && (
                <p className="text-xs text-muted-foreground mt-2">+ {products.length - 8} more products</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, barcode, or category..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Barcode</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              {isManager && (
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discount %</th>
              )}
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product, i) => {
              const margin = ((product.basePrice - product.costPrice) / product.basePrice * 100).toFixed(0);
              const productDiscount = getDiscountForProduct(product.id);
              const hasAnyDiscount = productDiscount > 0;
              const displayPrice = hasAnyDiscount ? getEffectivePrice(product.basePrice, product.id) : product.basePrice;
              return (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground font-mono">{product.barcode}</td>
                  <td className="px-5 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{product.category}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground text-right">R{product.costPrice}</td>
                  <td className="px-5 py-3 text-right">
                    {hasAnyDiscount ? (
                      <span className="text-sm">
                        <span className="text-muted-foreground line-through mr-1">R{product.basePrice}</span>
                        <span className="font-semibold text-primary">R{displayPrice.toFixed(2)}</span>
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">R{product.basePrice}</span>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm text-muted-foreground">
                        {productDiscounts[product.id] !== undefined ? `${productDiscounts[product.id]}%` : 'Global'}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3 text-sm font-medium text-success text-right">{margin}%</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {canEditDeleteProduct && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditFull(product)}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={`Edit product ${product.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteProduct(product)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {isManager ? (
                        <button
                          type="button"
                          onClick={() => openEditDiscount({ id: product.id, name: product.name })}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Edit discount for ${product.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      ) : (
                        !canEditDeleteProduct && (
                          <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" disabled>
                            <Edit className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set discount for product</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <>
              <p className="text-sm text-muted-foreground">{editProduct.name}</p>
              <div className="flex items-center gap-2 py-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={editPercent}
                  onChange={(e) => setEditPercent(e.target.value)}
                  placeholder={String(discountPercent)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">% off (leave empty for global)</span>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditDiscount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Product name</Label>
              <Input
                id="add-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Johnnie Walker Red"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-barcode">Barcode</Label>
              <Input
                id="add-barcode"
                value={newProduct.barcode}
                onChange={(e) => setNewProduct((p) => ({ ...p, barcode: e.target.value }))}
                placeholder="13-digit barcode"
              />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={newProduct.category}
                onValueChange={(v) => setNewProduct((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-cost">Cost price (R)</Label>
                <Input
                  id="add-cost"
                  type="number"
                  min={0}
                  step={0.01}
                  value={newProduct.costPrice}
                  onChange={(e) => setNewProduct((p) => ({ ...p, costPrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-base">Selling price (R)</Label>
                <Input
                  id="add-base"
                  type="number"
                  min={0}
                  step={0.01}
                  value={newProduct.basePrice}
                  onChange={(e) => setNewProduct((p) => ({ ...p, basePrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProduct}>Add product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editFullProduct} onOpenChange={(open) => !open && setEditFullProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          {editFullProduct && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Product name</Label>
                <Input
                  value={editFullForm.name}
                  onChange={(e) => setEditFullForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Product name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Barcode</Label>
                <Input
                  value={editFullForm.barcode}
                  onChange={(e) => setEditFullForm((f) => ({ ...f, barcode: e.target.value }))}
                  placeholder="Barcode"
                />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={editFullForm.category}
                  onValueChange={(v) => setEditFullForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Cost price (R)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editFullForm.costPrice}
                    onChange={(e) => setEditFullForm((f) => ({ ...f, costPrice: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Selling price (R)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editFullForm.basePrice}
                    onChange={(e) => setEditFullForm((f) => ({ ...f, basePrice: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFullProduct(null)}>Cancel</Button>
            <Button onClick={saveEditFull}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
          </DialogHeader>
          {deleteProduct && (
            <p className="text-sm text-muted-foreground">
              Remove <strong>{deleteProduct.name}</strong>? This cannot be undone.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProduct(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
