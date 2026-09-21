import { useState } from "react";
import { X } from "lucide-react";

import { createStockMovementItem } from "../../api/movements";

import type { Shop } from "../../types/shop";
import type { Warehouse } from "../../types/warehouse";
import type { MovementType } from "../../types/movement";

type LocationType = "SHOP" | "WAREHOUSE";

type ProductVariation = {
  guid: string;
  sku: string;
  size: string | null;
  color: string | null;
};

type Product = {
  guid: string;
  name: string;
  variations: ProductVariation[] | null;
};

type Props = {
  movementId: string;
  movementType: MovementType;

  sourceType?: LocationType;
  sourceId?: string;

  shops: Shop[];
  warehouses: Warehouse[];
  products: Product[];

  onClose: () => void;
  onCreated: () => Promise<void>;
  onSuccess?: (message: string) => void;
};

type SourceStock = {
  product_id: string;
  product_name: string;
  variation_id: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
};

function AddMovementItemModal({
  movementId,
  movementType,
  sourceType,
  sourceId,
  shops,
  warehouses,
  products,
  onClose,
  onCreated,
  onSuccess,
}: Props) {
  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [selectedVariationId, setSelectedVariationId] =
    useState("");

  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  /*
   * ----------------------------------------------------------------------
   * RECEIPT
   *
   * RECEIPT uchun source yo'q.
   * Productlar get_merchant_products dan keladi.
   * ----------------------------------------------------------------------
   */

  if (movementType === "RECEIPT") {
    return (
      <ReceiptMovementItemModal
        movementId={movementId}
        products={products}
        selectedProductId={selectedProductId}
        selectedVariationId={selectedVariationId}
        quantity={quantity}
        loading={loading}
        error={error}
        setSelectedProductId={setSelectedProductId}
        setSelectedVariationId={setSelectedVariationId}
        setQuantity={setQuantity}
        setLoading={setLoading}
        setError={setError}
        onClose={onClose}
        onCreated={onCreated}
        onSuccess={onSuccess}
      />
    );
  }

  /*
   * ----------------------------------------------------------------------
   * Boshqa movementlar
   *
   * SALE
   * RETURN
   * TRANSFER
   *
   * source stock ishlatiladi.
   * ----------------------------------------------------------------------
   */

  const selectedSource =
    sourceType === "SHOP"
      ? shops.find(
          (shop) => shop.guid === sourceId
        )
      : warehouses.find(
          (warehouse) =>
            warehouse.guid === sourceId
        );

  const sourceStocks: SourceStock[] =
    selectedSource?.stocks ?? [];

  /*
   * Source stocklardan productlarni guruhlaymiz.
   */

  const productMap = new Map<
    string,
    {
      guid: string;
      name: string;
      variations: SourceStock[];
    }
  >();

  for (const stock of sourceStocks) {
    const existing = productMap.get(
      stock.product_id
    );

    if (existing) {
      existing.variations.push(stock);
    } else {
      productMap.set(stock.product_id, {
        guid: stock.product_id,
        name: stock.product_name,
        variations: [stock],
      });
    }
  }

  const sourceProducts = Array.from(
    productMap.values()
  );

  const selectedProduct = sourceProducts.find(
    (product) =>
      product.guid === selectedProductId
  );

  const variations =
    selectedProduct?.variations ?? [];

  function handleProductChange(
    productId: string
  ) {
    setSelectedProductId(productId);
    setSelectedVariationId("");
    setError("");
  }

  async function handleSubmit() {
    try {
      setError("");

      if (!selectedProductId) {
        setError("Please select a product.");
        return;
      }

      if (!selectedVariationId) {
        setError("Please select a variation.");
        return;
      }

      if (quantity <= 0 || !Number.isFinite(quantity)) {
        setError(
          "Quantity must be greater than 0."
        );
        return;
      }

      setLoading(true);

      await createStockMovementItem({
        stock_movements_id: movementId,
        product_variations_id:
          selectedVariationId,
        quantity,
      });

      await onCreated();

      onClose();

      onSuccess?.("Product added successfully");
    } catch (error) {
      console.error(
        "Failed to add movement item:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to add product."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Add Product
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Add a product variation to this movement
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}

        <div className="space-y-4 px-6 py-5">

          {/* Product */}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Product
            </label>

            <select
              value={selectedProductId}
              onChange={(event) =>
                handleProductChange(
                  event.target.value
                )
              }
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100"
            >
              <option value="">
                Select product
              </option>

              {sourceProducts.map(
                (product) => (
                  <option
                    key={product.guid}
                    value={product.guid}
                  >
                    {product.name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Variation */}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Variation
            </label>

            <select
              value={selectedVariationId}
              onChange={(event) => {
                setSelectedVariationId(
                  event.target.value
                );
                setError("");
              }}
              disabled={
                !selectedProduct || loading
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100"
            >
              <option value="">
                Select variation
              </option>

              {variations.map(
                (variation) => (
                  <option
                    key={variation.variation_id}
                    value={variation.variation_id}
                  >
                    {variation.sku || "Variation"}

                    {variation.size
                      ? ` • ${variation.size}`
                      : ""}

                    {variation.color
                      ? ` • ${variation.color}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Quantity */}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Quantity
            </label>

            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => {
                setQuantity(
                  Number(event.target.value)
                );
                setError("");
              }}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100"
            />
          </div>

          {/* Error */}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Adding..."
              : "Add Product"}
          </button>

        </div>
      </div>
    </div>
  );
}

/*
 * ==========================================================================
 * RECEIPT MODAL
 * ==========================================================================
 *
 * RECEIPT uchun products get_merchant_products dan keladi.
 */

type ReceiptMovementItemModalProps = {
  movementId: string;
  products: Product[];

  selectedProductId: string;
  selectedVariationId: string;
  quantity: number;

  loading: boolean;
  error: string;

  setSelectedProductId: (
    value: string
  ) => void;

  setSelectedVariationId: (
    value: string
  ) => void;

  setQuantity: (
    value: number
  ) => void;

  setLoading: (
    value: boolean
  ) => void;

  setError: (
    value: string
  ) => void;

  onClose: () => void;
  onCreated: () => Promise<void>;
  onSuccess?: (message: string) => void;
};

function ReceiptMovementItemModal({
  movementId,
  products,
  selectedProductId,
  selectedVariationId,
  quantity,
  loading,
  error,
  setSelectedProductId,
  setSelectedVariationId,
  setQuantity,
  setLoading,
  setError,
  onClose,
  onCreated,
  onSuccess,
}: ReceiptMovementItemModalProps) {
  const selectedProduct = products.find(
    (product) =>
      product.guid === selectedProductId
  );

  const variations =
    selectedProduct?.variations ?? [];

  function handleProductChange(
    productId: string
  ) {
    setSelectedProductId(productId);
    setSelectedVariationId("");
    setError("");
  }

  async function handleSubmit() {
    try {
      setError("");

      if (!selectedProductId) {
        setError("Please select a product.");
        return;
      }

      if (!selectedVariationId) {
        setError("Please select a variation.");
        return;
      }

      if (quantity <= 0 || !Number.isFinite(quantity)) {
        setError(
          "Quantity must be greater than 0."
        );
        return;
      }

      setLoading(true);

      await createStockMovementItem({
        stock_movements_id: movementId,
        product_variations_id:
          selectedVariationId,
        quantity,
      });

      await onCreated();

      onClose();

      onSuccess?.("Product added successfully");
    } catch (error) {
      console.error(
        "Failed to add movement item:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to add product."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Add Product
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Add a product variation to this receipt
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}

        <div className="space-y-4 px-6 py-5">

          {/* Product */}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Product
            </label>

            <select
              value={selectedProductId}
              onChange={(event) =>
                handleProductChange(
                  event.target.value
                )
              }
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100"
            >
              <option value="">
                Select product
              </option>

              {products.map((product) => (
                <option
                  key={product.guid}
                  value={product.guid}
                  disabled={
                    !product.variations ||
                    product.variations.length === 0
                  }
                >
                  {product.name}
                  {!product.variations ||
                  product.variations.length === 0
                    ? " — No variations"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Variation */}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Variation
            </label>

            <select
              value={selectedVariationId}
              onChange={(event) => {
                setSelectedVariationId(
                  event.target.value
                );
                setError("");
              }}
              disabled={
                !selectedProduct ||
                variations.length === 0 ||
                loading
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100"
            >
              <option value="">
                {variations.length === 0
                  ? "No variations"
                  : "Select variation"}
              </option>

              {variations.map(
                (variation) => (
                  <option
                    key={variation.guid}
                    value={variation.guid}
                  >
                    {variation.sku || "Variation"}

                    {variation.size
                      ? ` • ${variation.size}`
                      : ""}

                    {variation.color
                      ? ` • ${variation.color}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Quantity */}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Quantity
            </label>

            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => {
                setQuantity(
                  Number(event.target.value)
                );
                setError("");
              }}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-100"
            />
          </div>

          {/* Error */}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Adding..."
              : "Add Product"}
          </button>

        </div>
      </div>
    </div>
  );
}

export default AddMovementItemModal;