import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Package,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";

import {
  getMerchantSales,
  getMerchantReceipts,
  getMerchantReturns,
  getMerchantWarehouseTransfers,
  getMerchantShopTransfers,
} from "../api/movements";

import { getMerchantShops } from "../api/shops";
import { getMerchantWarehouses } from "../api/warehouses";
import { getMerchantProducts } from "../api/product";

import type {
  FrontendMovement,
  MovementItem,
  MovementLocation,
  MovementStatus,
  MovementType,
} from "../types/movement";

import type { Shop } from "../types/shop";
import type { Warehouse } from "../types/warehouse";
import type { Product } from "../types/products";

import { MovementDetail } from "../components/movements/MovementDetail";
import SummaryCard from "../components/movements/SummaryCard";
import MovementCard from "../components/movements/MovementCard";
import AddMovementModal from "../components/movements/AddMovementModal";

type MovementsProps = {
  merchantId: string;
  shopId?: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeItems(items: MovementItem[] | null): MovementItem[] {
  return (items ?? []).map((item) => ({
    ...item,
    images: item.images ?? [],
  }));
}

function createLocation(
  id: string,
  name: string,
  type: MovementLocation["type"]
): MovementLocation {
  return {
    id,
    name,
    type,
  };
}

const TYPE_OPTIONS: { value: "ALL" | MovementType; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "SALE", label: "Sale" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "RETURN", label: "Return" },
];

const STATUS_OPTIONS: { value: "ALL" | MovementStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

function Movements({ merchantId, shopId }: MovementsProps) {
  const [movements, setMovements] = useState<FrontendMovement[]>([]);

  const [filter, setFilter] = useState<"ALL" | MovementType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MovementStatus>(
    "ALL"
  );
  const [search, setSearch] = useState("");

  const [selectedMovement, setSelectedMovement] =
    useState<FrontendMovement | null>(null);

  const [editingMovement, setEditingMovement] =
    useState<FrontendMovement | null>(null);

  const [showAddMovement, setShowAddMovement] = useState(false);

  const [shops, setShops] = useState<Shop[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Success Toast                                                            */
  /* ------------------------------------------------------------------------ */

  function showSuccessToast(message: string) {
    setToast({
      message,
      type: "success",
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  function showErrorToast(message: string) {
    setToast({
      message,
      type: "error",
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  /* ------------------------------------------------------------------------ */
  /* Load all data                                                            */
  /* ------------------------------------------------------------------------ */

  async function loadMovements(keepSelected = false) {
    try {
      setLoading(true);

      const [
        salesResponse,
        receiptsResponse,
        returnsResponse,
        warehouseTransfersResponse,
        shopTransfersResponse,
        shopsResponse,
        warehousesResponse,
        productsResponse,
      ] = await Promise.all([
        getMerchantSales({
          merchants_id: merchantId,
          ...(shopId ? { shop_id: shopId } : {}),
        }),

        getMerchantReceipts({
          merchants_id: merchantId,
        }),

        getMerchantReturns({
          merchants_id: merchantId,
          ...(shopId ? { shop_id: shopId } : {}),
        }),

        getMerchantWarehouseTransfers({
          merchants_id: merchantId,
          ...(shopId ? { shop_id: shopId } : {}),
        }),

        getMerchantShopTransfers({
          merchants_id: merchantId,
          ...(shopId ? { shop_id: shopId } : {}),
        }),

        getMerchantShops(merchantId),

        getMerchantWarehouses(merchantId),

        getMerchantProducts(merchantId),
      ]);

      /* -------------------------------------------------------------------- */
      /* Shops                                                                */
      /* -------------------------------------------------------------------- */

      setShops(shopsResponse.data.data.shops ?? []);

      /* -------------------------------------------------------------------- */
      /* Warehouses                                                           */
      /* -------------------------------------------------------------------- */

      setWarehouses(warehousesResponse.data.data.warehouses ?? []);

      /* -------------------------------------------------------------------- */
      /* Products                                                             */
      /* -------------------------------------------------------------------- */

      const products = productsResponse.data.data.products ?? [];

      setProducts(products);

      /* -------------------------------------------------------------------- */
      /* Normalize movements                                                  */
      /* -------------------------------------------------------------------- */

      const normalizedMovements: FrontendMovement[] = [];

      /* -------------------------------------------------------------------- */
      /* SALES                                                                 */
      /* -------------------------------------------------------------------- */

      for (const shop of salesResponse.data.data.shops) {
        for (const sale of shop.sales) {
          normalizedMovements.push({
            id: sale.guid,
            type: "SALE",
            status: (sale.status[0] ?? "DRAFT") as MovementStatus,
            items: normalizeItems(sale.items),
            from: createLocation(shop.guid, shop.name, "SHOP"),
            to: createLocation("", "Customer", "CUSTOMER"),
          });
        }
      }

      /* -------------------------------------------------------------------- */
      /* RECEIPTS                                                              */
      /* -------------------------------------------------------------------- */

      if (!shopId) {
        for (const warehouse of receiptsResponse.data.data.warehouses) {
          for (const receipt of warehouse.shipments) {
            normalizedMovements.push({
              id: receipt.guid,
              type: "RECEIPT",
              status: (receipt.status[0] ?? "DRAFT") as MovementStatus,
              items: normalizeItems(receipt.items),
              from: createLocation("", "External", "EXTERNAL"),
              to: createLocation(
                warehouse.guid,
                warehouse.name,
                "WAREHOUSE"
              ),
            });
          }
        }
      }

      /* -------------------------------------------------------------------- */
      /* RETURNS                                                               */
      /* -------------------------------------------------------------------- */

      for (const shop of returnsResponse.data.data.shops) {
        for (const returnMovement of shop.returns) {
          normalizedMovements.push({
            id: returnMovement.guid,
            type: "RETURN",
            status: (returnMovement.status[0] ?? "DRAFT") as MovementStatus,
            items: normalizeItems(returnMovement.items),
            from: createLocation(shop.guid, shop.name, "SHOP"),
            to: createLocation(
              returnMovement.destination_warehouse.guid,
              returnMovement.destination_warehouse.name,
              "WAREHOUSE"
            ),
          });
        }
      }

      /* -------------------------------------------------------------------- */
      /* WAREHOUSE TRANSFERS                                                   */
      /* -------------------------------------------------------------------- */

      for (const warehouse of warehouseTransfersResponse.data.data
        .warehouses) {
        for (const transfer of warehouse.transfers) {
          let destination: MovementLocation;

          if (transfer.destination_warehouse) {
            destination = createLocation(
              transfer.destination_warehouse.guid,
              transfer.destination_warehouse.name,
              "WAREHOUSE"
            );
          } else if (transfer.destination_shop) {
            destination = createLocation(
              transfer.destination_shop.guid,
              transfer.destination_shop.name,
              "SHOP"
            );
          } else {
            destination = createLocation("", "External", "EXTERNAL");
          }

          if (
            shopId &&
            (!transfer.destination_shop ||
              transfer.destination_shop.guid !== shopId)
          ) {
            continue;
          }

          normalizedMovements.push({
            id: transfer.guid,
            type: "TRANSFER",
            status: (transfer.status[0] ?? "DRAFT") as MovementStatus,
            items: normalizeItems(transfer.items),
            from: createLocation(
              warehouse.guid,
              warehouse.name,
              "WAREHOUSE"
            ),
            to: destination,
          });
        }
      }

      /* -------------------------------------------------------------------- */
      /* SHOP TRANSFERS                                                        */
      /* -------------------------------------------------------------------- */

      for (const shop of shopTransfersResponse.data.data.shops) {
        for (const transfer of shop.transfers) {
          let destination: MovementLocation;

          if (transfer.destination_shop) {
            destination = createLocation(
              transfer.destination_shop.guid,
              transfer.destination_shop.name,
              "SHOP"
            );
          } else if (transfer.destination_warehouse) {
            destination = createLocation(
              transfer.destination_warehouse.guid,
              transfer.destination_warehouse.name,
              "WAREHOUSE"
            );
          } else {
            destination = createLocation("", "External", "EXTERNAL");
          }

          if (
            shopId &&
            shop.guid !== shopId &&
            destination.id !== shopId
          ) {
            continue;
          }

          normalizedMovements.push({
            id: transfer.guid,
            type: "TRANSFER",
            status: (transfer.status[0] ?? "DRAFT") as MovementStatus,
            items: normalizeItems(transfer.items),
            from: createLocation(shop.guid, shop.name, "SHOP"),
            to: destination,
          });
        }
      }

      /* -------------------------------------------------------------------- */
      /* Save movements                                                       */
      /* -------------------------------------------------------------------- */

      setMovements(normalizedMovements);

      /*
       * Agar detail ichida turib item qo'shilgan bo'lsa,
       * shu movementni yangi items bilan qayta tanlaymiz.
       *
       * Oddiy reload bo'lsa esa detail yopiladi.
       */
      if (keepSelected && selectedMovement) {
        const updatedMovement = normalizedMovements.find(
          (movement) => movement.id === selectedMovement.id
        );

        if (updatedMovement) {
          setSelectedMovement(updatedMovement);
        }
      } else {
        setSelectedMovement(null);
      }
    } catch (error) {
      console.error("Failed to load movements:", error);
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Create / Update / Delete callbacks                                      */
  /* ------------------------------------------------------------------------ */

  async function handleMovementCreated() {
    await loadMovements();
    showSuccessToast("Movement created successfully");
  }

  async function handleMovementUpdated() {
    await loadMovements();
    showSuccessToast("Movement updated successfully");
  }

  async function handleMovementDeleted() {
    await loadMovements();
    showSuccessToast("Movement deleted successfully");
  }

  async function handleMovementStatusUpdated(
    message?: string,
    isError = false
  ) {
    if (message) {
      await loadMovements(false);

      if (isError) {
        showErrorToast(message);
      } else {
        showSuccessToast(message);
      }

      return;
    }

    await loadMovements(true);
  }

  /* ------------------------------------------------------------------------ */
  /* Load when merchant or shop changes                                      */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, shopId]);

  /* ------------------------------------------------------------------------ */
  /* Detail page                                                              */
  /* ------------------------------------------------------------------------ */

  if (selectedMovement) {
    return (
      <div>
        <MovementDetail
          movement={selectedMovement}
          shops={shops}
          warehouses={warehouses}
          products={products}
          onBack={() => setSelectedMovement(null)}
          onStatusUpdated={handleMovementStatusUpdated}
        />

        {toast && (
          <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
            {toast.type === "success" ? (
              <CheckCircle2
                size={18}
                className="text-green-600"
              />
            ) : (
              <XCircle
                size={18}
                className="text-red-600"
              />
            )}

            <p className="text-sm font-medium text-zinc-800">
              {toast.message}
            </p>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Search + Type + Status filters                                          */
  /* ------------------------------------------------------------------------ */

  const normalizedSearch = search.trim().toLowerCase();

  const filteredMovements = movements.filter((movement) => {
    if (filter !== "ALL" && movement.type !== filter) {
      return false;
    }

    if (statusFilter !== "ALL" && movement.status !== statusFilter) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const productMatches = movement.items?.some((item) => {
      const productName = String(
        (item as any).product_name ?? ""
      ).toLowerCase();

      const sku = String((item as any).sku ?? "").toLowerCase();

      return (
        productName.includes(normalizedSearch) ||
        sku.includes(normalizedSearch)
      );
    });

    const fromName = movement.from?.name
      ?.toLowerCase()
      .includes(normalizedSearch);

    const toName = movement.to?.name
      ?.toLowerCase()
      .includes(normalizedSearch);

    return productMatches || fromName || toName;
  });

  const hasActiveFilters =
    filter !== "ALL" ||
    statusFilter !== "ALL" ||
    normalizedSearch !== "";

  const clearFilters = () => {
    setFilter("ALL");
    setStatusFilter("ALL");
    setSearch("");
  };

  /* ------------------------------------------------------------------------ */
  /* Summary                                                                  */
  /* ------------------------------------------------------------------------ */

  const total = movements.length;

  const draftCount = movements.filter(
    (m) => m.status === "DRAFT"
  ).length;

  const acceptedCount = movements.filter(
    (m) => m.status === "ACCEPTED"
  ).length;

  const rejectedCount = movements.filter(
    (m) => m.status === "REJECTED"
  ).length;

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
          {toast.type === "success" ? (
            <CheckCircle2
              size={18}
              className="text-green-600"
            />
          ) : (
            <XCircle
              size={18}
              className="text-red-600"
            />
          )}

          <p className="text-sm font-medium text-zinc-800">
            {toast.message}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Stock Movements
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Transfers, sales, receipts and returns
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddMovement(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus size={17} />
          New Movement
        </button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total"
          value={total}
          icon={<Package size={18} />}
        />

        <SummaryCard
          label="Draft"
          value={draftCount}
          icon={<Clock3 size={18} />}
        />

        <SummaryCard
          label="Accepted"
          value={acceptedCount}
          icon={<CheckCircle2 size={18} />}
        />

        <SummaryCard
          label="Rejected"
          value={rejectedCount}
          icon={<XCircle size={18} />}
        />
      </div>

      {/* Filters toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movements by product, SKU or location..."
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "ALL" | MovementType)
            }
            className="h-10 min-w-[140px] appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400"
          >
            {TYPE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "ALL" | MovementStatus
              )
            }
            className="h-10 min-w-[140px] appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400"
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
            >
              <X size={15} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          Loading movements...
        </div>
      ) : filteredMovements.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
          <Package
            size={32}
            className="mx-auto mb-3 text-zinc-300"
          />

          <p className="text-sm font-medium text-zinc-700">
            No movements found
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            There are no movements matching the selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMovements.map((movement) => (
            <MovementCard
              key={movement.id}
              movement={movement}
              onClick={() =>
                setSelectedMovement(movement)
              }
              onEdit={() =>
                setEditingMovement(movement)
              }
              onDeleted={handleMovementDeleted}
            />
          ))}
        </div>
      )}

      {/* Add Movement Modal */}
      {showAddMovement && (
        <AddMovementModal
          shops={shops}
          warehouses={warehouses}
          products={products}
          merchantId={merchantId}
          shopId={shopId}
          onClose={() =>
            setShowAddMovement(false)
          }
          onCreated={handleMovementCreated}
        />
      )}

      {/* Edit Movement Modal */}
      {editingMovement && (
        <AddMovementModal
          shops={shops}
          warehouses={warehouses}
          products={products}
          merchantId={merchantId}
          shopId={shopId}
          movement={editingMovement}
          onClose={() =>
            setEditingMovement(null)
          }
          onCreated={handleMovementUpdated}
        />
      )}
    </div>
  );
}

export default Movements;

