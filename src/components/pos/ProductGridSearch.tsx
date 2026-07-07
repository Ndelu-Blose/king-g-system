import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart } from '@/contexts/CartContext';
import { useHappyHour } from '@/contexts/HappyHourContext';
import { useProducts } from '@/contexts/ProductsContext';
import { searchProducts, getCategories } from '@/lib/pos-api';
import type { Product, ProductWithStock } from '@/types/pos';
import { cn } from '@/lib/utils';

function resolveStock(product: Product, stockById: Map<string, number>): number {
  if (typeof product.stock === 'number') return product.stock;
  return stockById.get(product.id) ?? 0;
}

function withStock(product: Product, stock: number): ProductWithStock {
  return { ...product, stock };
}

function ProductGridCard({
  product,
  stock,
  price,
  onSelect,
}: {
  product: Product;
  stock: number;
  price: number;
  onSelect: () => void;
}) {
  const outOfStock = stock <= 0;

  return (
    <motion.button
      key={product.id}
      type="button"
      whileTap={outOfStock ? undefined : { scale: 0.97 }}
      disabled={outOfStock}
      onClick={onSelect}
      aria-disabled={outOfStock}
      className={cn(
        'glass-card p-3 text-left flex flex-col rounded-lg min-h-[100px] relative',
        outOfStock
          ? 'opacity-50 cursor-not-allowed border border-dashed border-muted-foreground/40 bg-muted/20'
          : 'card-hover'
      )}
    >
      {outOfStock && (
        <span className="absolute top-1.5 left-1.5 right-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-destructive bg-destructive/15 border border-destructive/30 px-1 py-0.5 rounded">
          Out of stock
        </span>
      )}
      <div
        className={cn(
          'w-full h-12 rounded-lg flex items-center justify-center mb-2 flex-shrink-0 mt-4',
          outOfStock ? 'bg-muted/40 grayscale' : 'bg-secondary/50'
        )}
      >
        <span className="text-xl">🥃</span>
      </div>
      <p
        className={cn(
          'text-xs font-medium leading-snug line-clamp-2 min-h-[2rem]',
          outOfStock ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {product.name}
      </p>
      <p className="text-xs text-muted-foreground">{product.category}</p>
      <p
        className={cn(
          'text-sm font-bold mt-auto pt-1 tabular-nums',
          outOfStock ? 'text-muted-foreground' : 'text-primary'
        )}
      >
        R{price.toFixed(2)}
      </p>
    </motion.button>
  );
}

function SearchResultRow({
  product,
  stock,
  price,
  onSelect,
}: {
  product: Product;
  stock: number;
  price: number;
  onSelect: () => void;
}) {
  const outOfStock = stock <= 0;

  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm flex justify-between items-center gap-2',
        outOfStock
          ? 'opacity-50 cursor-not-allowed bg-muted/30'
          : 'hover:bg-accent'
      )}
    >
      <span className="min-w-0">
        <span className={cn('block truncate', outOfStock && 'text-muted-foreground')}>{product.name}</span>
        {outOfStock && (
          <span className="text-[10px] font-semibold uppercase text-destructive">Out of stock</span>
        )}
      </span>
      <span
        className={cn(
          'font-medium tabular-nums shrink-0',
          outOfStock ? 'text-muted-foreground' : 'text-primary'
        )}
      >
        R{price.toFixed(2)}
      </span>
    </button>
  );
}

interface ProductGridSearchProps {
  /** When true, search bar is visible (manual add mode). */
  manualMode: boolean;
  onOpenManualMode: () => void;
  onCloseManualMode: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  /** When true (cashier), Scan Mode shows only [Manual Add]; no grid/categories/search. */
  cashierStrictScanMode?: boolean;
  /** When set with onControlledQueryChange, search lives in parent (e.g. CenterConsole); render only categories + typeahead + grid. */
  controlledQuery?: string;
  onControlledQueryChange?: (v: string) => void;
}

export function ProductGridSearch({
  manualMode,
  onOpenManualMode,
  onCloseManualMode,
  searchInputRef,
  cashierStrictScanMode = false,
  controlledQuery,
  onControlledQueryChange,
}: ProductGridSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const { products: allProducts } = useProducts();
  const searchRef = useRef<HTMLDivElement>(null);
  const { addProduct } = useCart();
  const { getEffectivePrice } = useHappyHour();

  const effectiveQuery = controlledQuery !== undefined ? controlledQuery : query;

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!effectiveQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchProducts(effectiveQuery, 12).then(setSearchResults);
    }, 150);
    return () => clearTimeout(t);
  }, [effectiveQuery]);

  const filteredGrid = useMemo(() => {
    if (selectedCategory === 'All') return allProducts;
    return allProducts.filter((p) => p.category === selectedCategory);
  }, [allProducts, selectedCategory]);

  const stockById = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p.stock ?? 0])),
    [allProducts]
  );

  const tryAddProduct = (product: Product) => {
    const stock = resolveStock(product, stockById);
    if (stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const added = addProduct(withStock(product, stock));
    if (!added) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    if (onControlledQueryChange) {
      onControlledQueryChange('');
    } else {
      setQuery('');
    }
    setSearchOpen(false);
    if (!onControlledQueryChange && manualMode) onCloseManualMode();
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (product: Product) => {
    tryAddProduct(product);
  };

  const handleCloseManualMode = () => {
    setQuery('');
    onCloseManualMode();
  };

  const manualAddButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={onOpenManualMode}
    >
      <UserPlus className="w-4 h-4" />
      Manual Add
    </Button>
  );

  const isControlledMode =
    controlledQuery !== undefined && onControlledQueryChange !== undefined;

  // Controlled mode (e.g. CenterConsole): only categories + typeahead + grid; no Manual Add, no Back to Scan, no search input
  if (isControlledMode) {
    return (
      <div className="flex flex-col flex-1 min-w-0" ref={searchRef}>
        {effectiveQuery.trim() && (
          <div className="mb-3 rounded-lg border bg-popover shadow-lg overflow-hidden">
            <ScrollArea className="max-h-64">
              {searchResults.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No products found</p>
              ) : (
                <ul className="p-1">
                  {searchResults.map((p) => {
                    const stock = resolveStock(p, stockById);
                    return (
                      <li key={p.id}>
                        <SearchResultRow
                          product={p}
                          stock={stock}
                          price={getEffectivePrice(p.basePrice, p.id)}
                          onSelect={() => handleSelectProduct(p)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
        <div className="flex gap-2 flex-wrap mb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                selectedCategory === cat
                  ? 'gold-gradient text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-sidebar-accent'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <ScrollArea className="flex-1 pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 content-start">
            {filteredGrid.map((product) => (
              <ProductGridCard
                key={product.id}
                product={product}
                stock={product.stock ?? 0}
                price={getEffectivePrice(product.basePrice, product.id)}
                onSelect={() => handleSelectProduct(product)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Cashier Scan Mode: only [Manual Add], no grid/categories/search
  if (!manualMode && cashierStrictScanMode) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-3">{manualAddButton}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {!manualMode ? (
        <div className="mb-3">
          {manualAddButton}
          <p className="text-xs text-muted-foreground mt-1">Search or tap grid when scan fails</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-medium text-foreground">Manual Mode</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseManualMode}
              aria-label="Back to Scan"
            >
              Back to Scan
            </Button>
          </div>
          <div ref={searchRef} className="relative mb-3 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search products or barcode…"
                className="pl-10 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground"
              />
              {searchOpen && (query.trim() || searchResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border bg-popover shadow-lg max-h-64 overflow-hidden">
                  <ScrollArea className="h-full max-h-64">
                    {searchResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No products found</p>
                    ) : (
                      <ul className="p-1">
                        {searchResults.map((p) => {
                          const stock = resolveStock(p, stockById);
                          return (
                            <li key={p.id}>
                              <SearchResultRow
                                product={p}
                                stock={stock}
                                price={getEffectivePrice(p.basePrice, p.id)}
                                onSelect={() => handleSelectProduct(p)}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Category pills – hidden for cashier in Scan Mode (handled above); shown when manualMode or non-cashier */}
      {(!cashierStrictScanMode || manualMode) && (
        <div className="flex gap-2 flex-wrap mb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                selectedCategory === cat
                  ? 'gold-gradient text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-sidebar-accent'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid – min 90px tiles, max 4 cols; hidden for cashier in Scan Mode */}
      {(!cashierStrictScanMode || manualMode) && (
        <ScrollArea className="flex-1 pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 content-start">
            {filteredGrid.map((product) => (
              <ProductGridCard
                key={product.id}
                product={product}
                stock={product.stock ?? 0}
                price={getEffectivePrice(product.basePrice, product.id)}
                onSelect={() => handleSelectProduct(product)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
