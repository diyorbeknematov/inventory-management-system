import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Plus,
  Search,
  Send,
  Warehouse as WarehouseIcon,
} from "lucide-react";

import type {
  FrontendMovement,
  MovementItem,
  MovementLocation,
} from "../../types/movement";

import type { ShopStock } from "../../types/shop";
import type { WarehouseStockItem } from "../../types/warehouse";
import type { ProductSelect } from "../../types/select_data";

import MovementProductCard from "./MovementProductCard";
import AddMovementItemModal from "./AddMovementItemModal";
import { StatusBadge } from "./MovementBadge";

import {
  getStockMovementItems,
  updateStockMovementStatus,
} from "../../api/movements";

import { getShopStocks } from "../../api/shops";
import { getWarehouseStocks } from "../../api/warehouses";
import { getProductsForSelect } from "../../api/select_data";

type Props = {
  movement: FrontendMovement;
  onBack: () => void;
  onStatusUpdated: (
    message?: string,
    isError?: boolean
  ) => Promise<void>;
};

type SourceLocation = {
  id: string;
  type: "SHOP" | "WAREHOUSE";
};

type SourceStock = {
  product_id: string;
  product_name: string;
  variation_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
};

function getSourceLocation(
  movement: FrontendMovement
): SourceLocation | null {
  if (movement.from.type === "SHOP") {
    return {
      id: movement.from.id,
      type: "SHOP",
    };
  }

  if (movement.from.type === "WAREHOUSE") {
    return {
      id: movement.from.id,
      type: "WAREHOUSE",
    };
  }

  return null;
}

function formatCreatedAt(value: string) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(
    /\.(\d{3})\d+Z$/,
    ".$1Z"
  );

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MovementDetail({
  movement,
  onBack,
  onStatusUpdated,
}: Props) {
  const [showAddProduct, setShowAddProduct] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [items, setItems] =
    useState<MovementItem[]>([]);

  const [itemsLoading, setItemsLoading] =
    useState(false);

  const [sourceStocks, setSourceStocks] =
    useState<SourceStock[]>([]);

  const [sourceStockLoading, setSourceStockLoading] =
    useState(false);

  const [productOptions, setProductOptions] =
    useState<ProductSelect[]>([]);

  const [productLoading, setProductLoading] =
    useState(false);

  const query = search.trim().toLowerCase();

  /* -------------------------------------------------------------------------- */
  /* Movement items                                                             */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setItemsLoading(true);
      setItems([]);

      try {
        const response =
          await getStockMovementItems({
            movement_id: movement.id,
          });

        if (cancelled) {
          return;
        }

        setItems(
          response.data.data.items ?? []
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load movement items:",
          error
        );

        setItems([]);
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
        }
      }
    }

    loadItems();

    return () => {
      cancelled = true;
    };
  }, [movement.id]);

  /* -------------------------------------------------------------------------- */
  /* Filter items                                                               */
  /* -------------------------------------------------------------------------- */

  const filteredItems = items.filter(
    (item) => {
      if (!query) {
        return true;
      }

      return (
        item.product_name
          ?.toLowerCase()
          .includes(query) ||
        item.sku
          ?.toLowerCase()
          .includes(query) ||
        item.variation_id
          ?.toLowerCase()
          .includes(query)
      );
    }
  );

  const productCount = new Set(
    filteredItems.map(
      (item) => item.product_id
    )
  ).size;

  const variationCount =
    filteredItems.length;

  const canEdit =
    movement.status === "DRAFT";

  const sourceLocation =
    getSourceLocation(movement);

  /* -------------------------------------------------------------------------- */
  /* Load data according to movement type                                       */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!canEdit) {
      setSourceStocks([]);
      setProductOptions([]);
      setSourceStockLoading(false);
      setProductLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMovementData() {
      /*
       * RECEIPT:
       * There is no source stock.
       * We need products from the merchant catalog.
       */
      if (movement.type === "RECEIPT") {
        console.log("RECEIPT uchun merchantId:", movement.merchantId);
        setSourceStocks([]);
        setSourceStockLoading(false);

        if (!movement.merchantId) {
          setProductOptions([]);
          setProductLoading(false);
          return;
        }

        setProductLoading(true);
        setProductOptions([]);

        try {
          const response =
            await getProductsForSelect(
              movement.merchantId
            );

          if (cancelled) {
            return;
          }

          setProductOptions(
            response.data.data.products ?? []
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            "Failed to load products:",
            error
          );

          setProductOptions([]);
        } finally {
          if (!cancelled) {
            setProductLoading(false);
          }
        }

        return;
      }

      /*
       * SALE / RETURN / TRANSFER:
       * Products come from the source stock.
       */
      setProductOptions([]);
      setProductLoading(false);

      if (!sourceLocation) {
        setSourceStocks([]);
        setSourceStockLoading(false);
        return;
      }

      setSourceStockLoading(true);
      setSourceStocks([]);

      try {
        if (
          sourceLocation.type ===
          "SHOP"
        ) {
          const response =
            await getShopStocks(
              sourceLocation.id
            );

          if (cancelled) {
            return;
          }

          const stocks: SourceStock[] =
            response.data.data.stocks.map(
              (stock: ShopStock) => ({
                product_id:
                  stock.product_id,
                product_name:
                  stock.product_name,
                variation_id:
                  stock.variation_id,
                sku:
                  stock.sku,
                size:
                  stock.size,
                color:
                  stock.color,
                quantity:
                  stock.quantity,
              })
            );

          setSourceStocks(stocks);
          return;
        }

        const response =
          await getWarehouseStocks(
            sourceLocation.id
          );

        if (cancelled) {
          return;
        }

        const stocks: SourceStock[] =
          response.data.data.stocks.map(
            (stock: WarehouseStockItem) => ({
              product_id:
                stock.product_id,
              product_name:
                stock.product_name,
              variation_id:
                stock.variation_id,
              sku:
                stock.sku,
              size:
                stock.size,
              color:
                stock.color,
              quantity:
                stock.quantity,
            })
          );

        setSourceStocks(stocks);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load source stocks:",
          error
        );

        setSourceStocks([]);
      } finally {
        if (!cancelled) {
          setSourceStockLoading(false);
        }
      }
    }

    loadMovementData();

    return () => {
      cancelled = true;
    };
  }, [
    canEdit,
    movement.type,
    movement.merchantId,
    sourceLocation?.id,
    sourceLocation?.type,
  ]);

  /* -------------------------------------------------------------------------- */
  /* Add product                                                                */
  /* -------------------------------------------------------------------------- */

  const canAddProduct =
    canEdit &&
    (
      movement.type === "RECEIPT" ||
      sourceLocation !== null
    );

  async function reloadItems() {
    try {
      const response = await getStockMovementItems({
        movement_id: movement.id,
      });

      setItems(response.data.data.items ?? []);
    } catch (error) {
      console.error("Failed to reload movement items:", error);
    }
  }

  async function handleProductCreated() {
    await onStatusUpdated();
    await reloadItems();
  }

  async function handleItemDeleted() {
    await onStatusUpdated();
    await reloadItems();
  }

  /* -------------------------------------------------------------------------- */
  /* Send movement                                                              */
  /* -------------------------------------------------------------------------- */

  async function handleSend() {
    if (
      sending ||
      movement.status !== "DRAFT"
    ) {
      return;
    }

    setSending(true);

    try {
      await updateStockMovementStatus({
        guid: movement.id,

        shops_id:
          movement.from.type === "SHOP"
            ? movement.from.id
            : undefined,

        shops_id_2:
          movement.to.type === "SHOP"
            ? movement.to.id
            : undefined,

        warehouse_id:
          movement.from.type === "WAREHOUSE"
            ? movement.from.id
            : undefined,

        warehouse_id_2:
          movement.to.type === "WAREHOUSE"
            ? movement.to.id
            : undefined,

        status: "SENT",
        type: movement.type,
      });

      await onStatusUpdated(
        "Movement sent successfully",
        false
      );
    } catch (error) {
      console.error(
        "Failed to send stock movement:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to send stock movement";

      await onStatusUpdated(
        message,
        true
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {/* Back */}

      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
      >
        <ArrowLeft size={17} />
        Back to Movements
      </button>

      {/* Header */}

      <div className="mb-6">
        <div className="flex flex-col gap-5">

          {/* Movement info */}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100">
                {movement.type === "RECEIPT" ? (
                  <WarehouseIcon
                    size={25}
                    className="text-zinc-500"
                  />
                ) : (
                  <Package
                    size={25}
                    className="text-zinc-500"
                  />
                )}
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-zinc-900">
                    {movement.type}
                  </h1>

                  <StatusBadge
                    status={movement.status}
                  />
                </div>

                <p className="text-xs text-zinc-400">
                  ID: {movement.id}
                </p>

                {movement.created_at && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Created:{" "}
                    {formatCreatedAt(
                      movement.created_at
                    )}
                  </p>
                )}
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />

                {sending
                  ? "Sending..."
                  : "Send"}
              </button>
            )}
          </div>

          {/* Route */}

          <div className="w-fit min-w-[320px] rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-4">
              <MovementLocationView
                label="From"
                location={movement.from}
              />

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                <ArrowRight
                  size={17}
                  className="text-zinc-500"
                />
              </div>

              <MovementLocationView
                label="To"
                location={movement.to}
              />
            </div>
          </div>

          {/* Stats */}

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <DetailStat
                label="Products"
                value={productCount}
              />

              <DetailStat
                label="Variations"
                value={variationCount}
              />

              <DetailStat
                label="Status"
                value={movement.status}
              />
            </div>

            {canAddProduct && (
              <button
                type="button"
                onClick={() =>
                  setShowAddProduct(true)
                }
                disabled={
                  sourceStockLoading ||
                  productLoading ||
                  itemsLoading
                }
                className="flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />

                {sourceStockLoading ||
                productLoading
                  ? "Loading..."
                  : "Add Product"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search */}

      {items.length > 0 && (
        <div className="mb-5">
          <div className="relative max-w-md">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search product, SKU, size, color..."
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
            />
          </div>
        </div>
      )}

      {/* Products */}

      {itemsLoading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
          <Package
            size={32}
            className="mx-auto mb-3 animate-pulse text-zinc-300"
          />

          <p className="text-sm font-medium text-zinc-700">
            Loading products...
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            Loading movement products.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
          <Package
            size={32}
            className="mx-auto mb-3 text-zinc-300"
          />

          <p className="text-sm font-medium text-zinc-700">
            No products
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            Add a product to this movement.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
          <Search
            size={32}
            className="mx-auto mb-3 text-zinc-300"
          />

          <p className="text-sm font-medium text-zinc-700">
            No matching products
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            Try searching by product name, SKU, size, or color.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map(
            (item) => (
              <MovementProductCard
                key={item.variation_id}
                item={item}
                status={movement.status}
                onDeleted={handleItemDeleted}
              />
            )
          )}
        </div>
      )}

      {/* Add Product Modal */}

      {showAddProduct &&
        canAddProduct && (
          <AddMovementItemModal
            movementId={
              movement.id
            }
            movementType={
              movement.type
            }
            productOptions={
              productOptions
            }
            sourceStocks={
              sourceStocks
            }
            onClose={() =>
              setShowAddProduct(
                false
              )
            }
            onCreated={
              handleProductCreated
            }
          />
        )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail Stat                                                                */
/* -------------------------------------------------------------------------- */

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-zinc-800">
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Location                                                                   */
/* -------------------------------------------------------------------------- */

export function MovementLocationView({
  label,
  location,
}: {
  label: string;
  location: MovementLocation;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <div className="flex min-w-0 items-center gap-2">
        <p className="max-w-[120px] truncate text-sm font-medium text-zinc-800">
          {location.name}
        </p>

        <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
          {location.type}
        </span>
      </div>
    </div>
  );
}