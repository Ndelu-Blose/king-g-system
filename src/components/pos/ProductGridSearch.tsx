import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart } from '@/contexts/CartContext';
import { useHappyHour } from '@/contexts/HappyHourContext';
import { searchProducts, getAllProducts, getCategories } from '@/lib/pos-api';
import type { Product, ProductWithStock } from '@/types/pos';
import { cn } from '@/lib/utils';

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
  const [allProducts, setAllProducts] = useState<ProductWithStock[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const { addProduct } = useCart();
  const { getEffectivePrice } = useHappyHour();

  const effectiveQuery = controlledQuery !== undefined ? controlledQuery : query;

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);
  useEffect(() => {
    getAllProducts().then(setAllProducts);
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
    addProduct(product);
    if (onControlledQueryChange) {
      onControlledQueryChange('');
    } else {
      setQuery('');
    }
    setSearchOpen(false);
    if (!onControlledQueryChange && manualMode) onCloseManualMode();
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
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex justify-between items-center'
                        )}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-primary font-medium tabular-nums ml-2">
                          R{getEffectivePrice(p.basePrice, p.id).toFixed(2)}
                        </span>
                      </button>
                    </li>
                  ))}
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
              <motion.button
                key={product.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectProduct(product)}
                className="glass-card card-hover p-3 text-left flex flex-col rounded-lg min-h-[90px]"
              >
                <div className="w-full h-12 rounded-lg bg-secondary/50 flex items-center justify-center mb-2 flex-shrink-0">
                  <span className="text-xl">🥃</span>
                </div>
                <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.category}</p>
                <p className="text-sm font-bold text-primary mt-auto pt-1 tabular-nums">
                  R{getEffectivePrice(product.basePrice, product.id).toFixed(2)}
                </p>
              </motion.button>
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
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectProduct(p)}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex justify-between items-center'
                              )}
                            >
                              <span className="truncate">{p.name}</span>
                              <span className="text-primary font-medium tabular-nums ml-2">
                                R{getEffectivePrice(p.basePrice, p.id).toFixed(2)}
                              </span>
                            </button>
                          </li>
                        ))}
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
              <motion.button
                key={product.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectProduct(product)}
                className="glass-card card-hover p-3 text-left flex flex-col rounded-lg min-h-[90px]"
              >
                <div className="w-full h-12 rounded-lg bg-secondary/50 flex items-center justify-center mb-2 flex-shrink-0">
                  <span className="text-xl">🥃</span>
                </div>
                <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.category}</p>
                <p className="text-sm font-bold text-primary mt-auto pt-1 tabular-nums">
                  R{getEffectivePrice(product.basePrice, product.id).toFixed(2)}
                </p>
              </motion.button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
