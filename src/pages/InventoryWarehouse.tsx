import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { Search, AlertTriangle, Boxes, Warehouse } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { motion } from 'framer-motion';

const lowStockThreshold = 10;

export default function InventoryWarehouse() {
  const { inventory } = useInventory();
  const [search, setSearch] = useState('');
  const location = useLocation();
  const isWarehouse = location.pathname === '/inventory/warehouse';

  const filtered = inventory.filter(
    (item) =>
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const warehouseValue = filtered.reduce((sum, i) => sum + i.warehouseQty * i.costPrice, 0);
  const lowStockCount = filtered.filter((i) => i.warehouseQty < lowStockThreshold).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/inventory" label="Back to Inventory" />
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Warehouse stock</h1>
        <p className="text-sm text-muted-foreground">Stock levels and value at the Warehouse location</p>
      </div>

      {/* Location tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        <Link
          to="/inventory"
          className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
            location.pathname === '/inventory' ? 'gold-gradient text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </Link>
        <Link
          to="/inventory/lounge"
          className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
            location.pathname === '/inventory/lounge' ? 'gold-gradient text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Lounge
        </Link>
        <Link
          to="/inventory/warehouse"
          className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
            isWarehouse ? 'gold-gradient text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Warehouse
        </Link>
      </div>

      {/* Summary Cards - Warehouse focused */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Warehouse SKUs</p>
            <p className="text-xl font-bold text-foreground">{filtered.length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <Boxes className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Warehouse value</p>
            <p className="text-xl font-bold text-foreground">R{warehouseValue.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Low stock (Warehouse)</p>
            <p className="text-xl font-bold text-warning">{lowStockCount}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lounge</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Warehouse</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => {
              const isLow = item.warehouseQty < lowStockThreshold;
              return (
                <motion.tr
                  key={item.productId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{item.productName}</td>
                  <td className="px-5 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{item.category}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-right text-foreground">{item.loungeQty}</td>
                  <td className={`px-5 py-3 text-sm text-right font-semibold ${isLow ? 'text-warning' : 'text-foreground'}`}>{item.warehouseQty}</td>
                  <td className="px-5 py-3 text-sm text-right font-bold text-foreground">{item.totalQty}</td>
                  <td className="px-5 py-3 text-sm text-right text-muted-foreground">R{(item.totalQty * item.costPrice).toLocaleString()}</td>
                  <td className="px-5 py-3 text-center">
                    {isLow ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">Low Stock</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">In Stock</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
