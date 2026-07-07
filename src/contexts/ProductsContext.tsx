import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ProductWithStock } from '@/types/pos';
import {
  createProduct as apiCreateProduct,
  deleteProduct as apiDeleteProduct,
  getAllProducts,
  subscribeToProductCatalog,
  updateProduct as apiUpdateProduct,
  type ProductInput,
} from '@/lib/pos-api';

type ProductsContextValue = {
  products: ProductWithStock[];
  loading: boolean;
  refreshProducts: () => Promise<void>;
  createProduct: (input: ProductInput) => Promise<ProductWithStock>;
  updateProduct: (id: string, input: ProductInput) => Promise<ProductWithStock>;
  deleteProduct: (id: string) => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProducts = useCallback(async () => {
    try {
      const rows = await getAllProducts();
      setProducts(rows);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    return subscribeToProductCatalog(() => {
      void refreshProducts();
    });
  }, [refreshProducts]);

  const createProduct = useCallback(async (input: ProductInput) => {
    const created = await apiCreateProduct(input);
    await refreshProducts();
    return created;
  }, [refreshProducts]);

  const updateProduct = useCallback(async (id: string, input: ProductInput) => {
    const updated = await apiUpdateProduct(id, input);
    await refreshProducts();
    return updated;
  }, [refreshProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    await apiDeleteProduct(id);
    await refreshProducts();
  }, [refreshProducts]);

  return (
    <ProductsContext.Provider
      value={{ products, loading, refreshProducts, createProduct, updateProduct, deleteProduct }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
