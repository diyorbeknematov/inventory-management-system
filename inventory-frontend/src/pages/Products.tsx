import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Package,
  Search,
  Plus,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";

import {
  getProducts,
  getProductVariations,
  deleteProduct,
} from "../api/product";

import type {
  Category,
  Product,
  Variation,
} from "../types/products";

import ProductCard from "../components/products/ProductCard";
import CategoryTreeItem from "../components/products/CategoryTreeItem";
import CreateProductModal from "../components/products/CreateProductModal";
import ProductDetailsDrawer from "../components/products/ProductDetailsDrawer";
import UpdateProductModal from "../components/products/UpdateProductModal";

type ProductsProps = {
  merchantId?: string;
};

type ToastType = "success" | null;

type Toast = {
  type: ToastType;
  message: string;
};

export default function Products({
  merchantId,
}: ProductsProps) {
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [activeCategoryId, setActiveCategoryId] =
    useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [
    selectedProductVariations,
    setSelectedProductVariations,
  ] = useState<Variation[]>([]);

  const [editProduct, setEditProduct] =
    useState<Product | null>(null);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [variationLoading, setVariationLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    deleteProductTarget,
    setDeleteProductTarget,
  ] = useState<Product | null>(null);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const [deleteMessage, setDeleteMessage] =
    useState("");

  const [toast, setToast] =
    useState<Toast | null>(null);

  const showSuccessToast = useCallback(
    (message: string) => {
      setToast({
        type: "success",
        message,
      });

      setTimeout(() => {
        setToast(null);
      }, 3000);
    },
    []
  );

  // =========================================================
  // LOAD PRODUCTS
  // =========================================================

  const loadProducts = useCallback(
    async (searchValue = "") => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await getProducts(
            merchantId,
            searchValue
          );

        const data =
          response.data.data;

        setProducts(
          data.products ?? []
        );

        setCategories(
          data.categories ?? []
        );

        // Merchant o'zgarganda eski
        // category va product tanlovlarini tozalaymiz
        setActiveCategoryId(null);
        setSelectedProduct(null);
        setSelectedProductVariations([]);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load products"
        );
      } finally {
        setLoading(false);
      }
    },
    [merchantId]
  );

  // =========================================================
  // SELECT PRODUCT
  // =========================================================

  async function handleProductSelect(
    product: Product
  ) {
    setSelectedProduct(product);

    // Eski product variationlarini tozalaymiz
    setSelectedProductVariations([]);

    try {
      setVariationLoading(true);

      const response =
        await getProductVariations(
          product.guid
        );

      const variations =
        response.data.data.variations ?? [];

      setSelectedProductVariations(
        variations
      );
    } catch (err) {
      console.error(
        "Failed to load product variations:",
        err
      );

      setSelectedProductVariations([]);
    } finally {
      setVariationLoading(false);
    }
  }

  // =========================================================
  // DELETE PRODUCT
  // =========================================================

  function openDeleteProductModal(
    product: Product
  ) {
    setDeleteProductTarget(product);
    setDeleteError("");
    setDeleteMessage("");
  }

  function closeDeleteProductModal() {
    if (deleteLoading) {
      return;
    }

    setDeleteProductTarget(null);
    setDeleteError("");
    setDeleteMessage("");
  }

  async function handleDeleteProduct() {
    if (!deleteProductTarget) {
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError("");
      setDeleteMessage("");

      await deleteProduct(
        deleteProductTarget.guid
      );

      setDeleteMessage(
        "Product deleted successfully"
      );

      await loadProducts(search);

      setDeleteProductTarget(null);
      setDeleteMessage("");

      showSuccessToast(
        "Product deleted successfully"
      );
    } catch (err) {
      console.error(
        "Failed to delete product:",
        err
      );

      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete product"
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  // =========================================================
  // UPDATE PRODUCT
  // =========================================================

  async function handleProductUpdated() {
    await loadProducts(search);

    setEditProduct(null);

    showSuccessToast(
      "Product updated successfully"
    );
  }

  // =========================================================
  // EFFECTS
  // =========================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(search);
    }, 300);

    return () =>
      clearTimeout(timer);
  }, [search, loadProducts]);

  // =========================================================
  // CATEGORY HELPERS
  // =========================================================

  const findCategory = (
    list: Category[],
    id: string
  ): Category | null => {
    for (const category of list) {
      if (category.guid === id) {
        return category;
      }

      const found = findCategory(
        category.subcategories ?? [],
        id
      );

      if (found) {
        return found;
      }
    }

    return null;
  };

  const collectCategoryProducts = (
    category: Category
  ): Product[] => {
    const result: Product[] = [
      ...(category.products ?? []),
    ];

    for (
      const subcategory of
      category.subcategories ?? []
    ) {
      result.push(
        ...collectCategoryProducts(
          subcategory
        )
      );
    }

    const unique =
      new Map<string, Product>();

    for (const product of result) {
      unique.set(
        product.guid,
        product
      );
    }

    return Array.from(
      unique.values()
    );
  };

  const activeCategory =
    activeCategoryId
      ? findCategory(
          categories,
          activeCategoryId
        )
      : null;

  const currentProducts =
    activeCategory
      ? collectCategoryProducts(
          activeCategory
        )
      : products;

  const filteredProducts =
    useMemo(() => {
      return currentProducts;
    }, [currentProducts]);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-sm text-zinc-500">
          Loading products...
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-medium text-red-700">
          {error}
        </p>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="flex min-h-full flex-col">
      {/* SUCCESS TOAST */}
      {toast && (
        <div className="fixed right-5 top-5 z-[500]">
          <div className="flex min-w-[300px] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2
                size={20}
                className="text-emerald-500"
              />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900">
                Success
              </p>

              <p className="mt-0.5 text-sm text-zinc-500">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setToast(null)
              }
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Products
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage your products and variations
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
          }}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus size={17} />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search products..."
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>

        <div className="text-sm text-zinc-500">
          {filteredProducts.length} products
        </div>
      </div>

      {/* Main */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* Sidebar */}
        <aside className="w-60 shrink-0">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Categories
            </p>

            <button
              onClick={() =>
                setActiveCategoryId(null)
              }
              className={`mb-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                activeCategoryId === null
                  ? "bg-zinc-900 font-medium text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              All Products
            </button>

            {categories.map(
              (category) => (
                <CategoryTreeItem
                  key={category.guid}
                  category={category}
                  activeCategoryId={
                    activeCategoryId
                  }
                  onSelect={
                    setActiveCategoryId
                  }
                />
              )
            )}
          </div>
        </aside>

        {/* Products */}
        <main className="min-w-0 flex-1">
          {filteredProducts.length === 0 ? (
            <EmptyProducts />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={product.guid}
                    product={product}
                    onClick={() =>
                      handleProductSelect(
                        product
                      )
                    }
                    onEdit={() =>
                      setEditProduct(product)
                    }
                    onDelete={() =>
                      openDeleteProductModal(
                        product
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create product */}
      {showCreateModal && (
        <CreateProductModal
          merchantId={merchantId}
          onClose={() =>
            setShowCreateModal(false)
          }
          onCreated={loadProducts}
        />
      )}

      {/* Details drawer */}
      {selectedProduct && (
        <ProductDetailsDrawer
          product={selectedProduct}
          variations={
            selectedProductVariations
          }
          variationLoading={
            variationLoading
          }
          onClose={() => {
            setSelectedProduct(null);
            setSelectedProductVariations([]);
          }}
          onVariationCreated={async () => {
            if (!selectedProduct) {
              return;
            }

            const response =
              await getProductVariations(
                selectedProduct.guid
              );

            setSelectedProductVariations(
              response.data.data.variations ?? []
            );
          }}
          onSuccess={showSuccessToast}
        />
      )}

      {/* Update product */}
      {editProduct && (
        <UpdateProductModal
          product={editProduct}
          categories={categories}
          onClose={() =>
            setEditProduct(null)
          }
          onUpdated={
            handleProductUpdated
          }
        />
      )}

      {/* Delete product */}
      {deleteProductTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Delete Product
              </h2>

              <button
                type="button"
                onClick={
                  closeDeleteProductModal
                }
                disabled={deleteLoading}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              {!deleteMessage && (
                <>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                    <Trash2
                      size={20}
                      className="text-red-500"
                    />
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-800">
                    Are you sure you want to
                    delete this product?
                  </h3>

                  <div className="mt-3 rounded-lg bg-zinc-50 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-800">
                      {deleteProductTarget.name}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      This action cannot be
                      undone.
                    </p>
                  </div>
                </>
              )}

              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">
                    {deleteError}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={
                  closeDeleteProductModal
                }
                disabled={deleteLoading}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleDeleteProduct
                }
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} />

                {deleteLoading
                  ? "Deleting..."
                  : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyProducts() {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
      <div className="text-center">
        <Package
          size={40}
          strokeWidth={1.2}
          className="mx-auto text-zinc-300"
        />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          No products found
        </p>

        <p className="mt-1 text-xs text-zinc-400">
          Try changing your search or category.
        </p>
      </div>
    </div>
  );
}