import {
  useEffect,
  useState,
} from "react";

import { createWarehouseStock } from "../../api/warehouses";
import { getMerchantProducts } from "../../api/product";

import type {
  Product,
  Variation,
} from "../../types/products";

type AddStockModalProps = {
  merchantId: string;
  warehouseId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export default function AddStockModal({
  merchantId,
  warehouseId,
  onClose,
  onCreated,
}: AddStockModalProps) {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [selectedVariationId, setSelectedVariationId] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  const [loadingProducts, setLoadingProducts] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoadingProducts(true);
        setError(null);

        const response =
          await getMerchantProducts(merchantId);

        const allProducts =
          response.data.data.products ?? [];

        setProducts(allProducts);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load products"
        );
      } finally {
        setLoadingProducts(false);
      }
    }

    loadProducts();
  }, [merchantId]);

  const variations: {
    product: Product;
    variation: Variation;
  }[] = [];

  for (const product of products) {
    for (const variation of product.variations ?? []) {
      variations.push({
        product,
        variation,
      });
    }
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!selectedVariationId) {
      setError(
        "Please select a product variation"
      );
      return;
    }

    const parsedQuantity = Number(quantity);

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 0
    ) {
      setError(
        "Quantity must be a non-negative integer"
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response =
        await createWarehouseStock({
          warehouse_id: warehouseId,
          product_variations_id:
            selectedVariationId,
          quantity: parsedQuantity,
        });

      if (
        response.status !== "success" &&
        response.data?.status !== "success"
      ) {
        throw new Error(
          response.custom_message ||
            response.description ||
            "Failed to create warehouse stock"
        );
      }

      await onCreated();
      onClose();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create warehouse stock"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]"
      />

      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl">
          {/* Header */}

          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Add Stock
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Add a product variation to this warehouse.
            </p>
          </div>

          {/* Form */}

          <form
            onSubmit={handleSubmit}
            className="p-5"
          >
            <div className="space-y-4">
              {/* Product variation */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Product variation
                </label>

                <select
                  value={selectedVariationId}
                  onChange={(event) =>
                    setSelectedVariationId(
                      event.target.value
                    )
                  }
                  disabled={
                    loadingProducts || loading
                  }
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                >
                  <option value="">
                    {loadingProducts
                      ? "Loading products..."
                      : "Select product variation"}
                  </option>

                  {variations.map(
                    ({ product, variation }) => (
                      <option
                        key={variation.guid}
                        value={variation.guid}
                      >
                        {product.name} —{" "}
                        {variation.sku}
                        {variation.size
                          ? ` — ${variation.size}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Quantity */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Quantity
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target.value
                    )
                  }
                  placeholder="e.g. 100"
                  disabled={loading}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                />
              </div>

              {/* Error */}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  loadingProducts ||
                  variations.length === 0
                }
                className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Adding..."
                  : "Add Stock"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
