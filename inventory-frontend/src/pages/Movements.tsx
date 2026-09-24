import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock3,
  Package,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { getStockMovements } from "../api/movements";
import { getShops } from "../api/shops";
import { getWarehouses } from "../api/warehouses";

import type {
  FrontendMovement,
  MovementItem,
  MovementLocation,
  MovementStatus,
  MovementType,
} from "../types/movement";

import type { Shop } from "../types/shop";
import type { Warehouse } from "../types/warehouse";

import { MovementDetail } from "../components/movements/MovementDetail";
import SummaryCard from "../components/movements/SummaryCard";
import MovementCard from "../components/movements/MovementCard";
import AddMovementModal from "../components/movements/AddMovementModal";

import type { Merchant } from "../types/merchant";

type MovementsProps = {
  merchants: Merchant[]
  merchantId?: string;
  shopId?: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

const TYPE_OPTIONS: {
  value: "ALL" | MovementType;
  label: string;
}[] = [
  { value: "ALL", label: "All types" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "SALE", label: "Sale" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "RETURN", label: "Return" },
];

const STATUS_OPTIONS: {
  value: "ALL" | MovementStatus;
  label: string;
}[] = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

function Movements({
  merchants,
  merchantId,
  shopId,
}: MovementsProps) {
  const [movements, setMovements] =
    useState<FrontendMovement[]>([]);

  const [filter, setFilter] =
    useState<"ALL" | MovementType>("ALL");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | MovementStatus>("ALL");

  const [search, setSearch] =
    useState("");

  const [selectedMovement, setSelectedMovement] =
    useState<FrontendMovement | null>(null);

  const [editingMovement, setEditingMovement] =
    useState<FrontendMovement | null>(null);

  const [showAddMovement, setShowAddMovement] =
    useState(false);

  /* ------------------------------------------------------------------------ */
  /* Prevent duplicate concurrent loads                                       */
  /* ------------------------------------------------------------------------ */

  const loadingRef = useRef(false);

  /* ------------------------------------------------------------------------ */
  /* Locations                                                                */
  /* ------------------------------------------------------------------------ */

  const [shops, setShops] =
    useState<Shop[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Toast                                                                    */
  /* ------------------------------------------------------------------------ */

  function showSuccessToast(
    message: string
  ) {
    setToast({
      message,
      type: "success",
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  function showErrorToast(
    message: string
  ) {
    setToast({
      message,
      type: "error",
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  /* ------------------------------------------------------------------------ */
  /* Load data                                                                */
  /* ------------------------------------------------------------------------ */

  async function loadMovements(
    keepSelected = false
  ) {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      setLoading(true);

      const movementRequest = merchantId
        ? {
            merchants_id: merchantId,
          }
        : {};

      /*
       * Bu componentda faqat:
       *
       * 1. getStockMovements
       * 2. getShops
       * 3. getWarehouses
       *
       * requestlari ketadi.
       *
       * getShopStocks
       * getWarehouseStocks
       * getProductsForSelect
       *
       * BU YERDA YO'Q.
       */

      const [
        movementsResponse,
        shopsResponse,
        warehousesResponse,
      ] = await Promise.all([
        getStockMovements(
          movementRequest
        ),

        getShops(
          merchantId || undefined
        ),

        getWarehouses(
          merchantId || undefined
        ),
      ]);

      /* -------------------------------------------------------------------- */
      /* Shops                                                                 */
      /* -------------------------------------------------------------------- */

      const shopsData =
        shopsResponse.data.data.shops ?? [];

      setShops(shopsData);

      /* -------------------------------------------------------------------- */
      /* Warehouses                                                            */
      /* -------------------------------------------------------------------- */

      const warehousesData =
        warehousesResponse.data.data
          .warehouses ?? [];

      setWarehouses(
        warehousesData
      );

      /* -------------------------------------------------------------------- */
      /* Maps                                                                  */
      /* -------------------------------------------------------------------- */

      const shopMap = new Map(
        shopsData.map((shop) => [
          shop.guid,
          shop.name,
        ])
      );

      const warehouseMap =
        new Map(
          warehousesData.map(
            (warehouse) => [
              warehouse.guid,
              warehouse.name,
            ]
          )
        );

      /* -------------------------------------------------------------------- */
      /* Backend movements                                                     */
      /* -------------------------------------------------------------------- */

      const backendMovements =
        movementsResponse.data.data
          .movements ?? [];

      /* -------------------------------------------------------------------- */
      /* Normalize                                                             */
      /* -------------------------------------------------------------------- */

      const normalizedMovements:
        FrontendMovement[] =
        backendMovements.map(
          (movement) => {
            const type =
              (movement.type?.[0] ??
                "TRANSFER") as MovementType;

            const status =
              (movement.status?.[0] ??
                "DRAFT") as MovementStatus;

            /*
             * Items intentionally NOT loaded here.
             *
             * getStockMovementItems()
             * faqat MovementDetail ochilganda ishlaydi.
             */

            const items: MovementItem[] = [];

            let from: MovementLocation;
            let to: MovementLocation;

            /* -------------------------------------------------------------- */
            /* SALE                                                             */
            /* -------------------------------------------------------------- */

            if (type === "SALE") {
              const shopName =
                movement.shops_id
                  ? shopMap.get(
                      movement.shops_id
                    ) ?? "Shop"
                  : "Shop";

              from =
                createLocation(
                  movement.shops_id ??
                    "",
                  shopName,
                  "SHOP"
                );

              to =
                createLocation(
                  "",
                  "Customer",
                  "CUSTOMER"
                );
            }

            /* -------------------------------------------------------------- */
            /* RECEIPT                                                          */
            /* -------------------------------------------------------------- */

            else if (
              type === "RECEIPT"
            ) {
              const warehouseName =
                movement.warehouse_id_2
                  ? warehouseMap.get(
                      movement.warehouse_id_2
                    ) ??
                    "Warehouse"
                  : "Warehouse";

              from =
                createLocation(
                  "",
                  "External",
                  "EXTERNAL"
                );

              to =
                createLocation(
                  movement.warehouse_id_2 ??
                    "",
                  warehouseName,
                  "WAREHOUSE"
                );
            }

            /* -------------------------------------------------------------- */
            /* RETURN                                                           */
            /* -------------------------------------------------------------- */

            else if (
              type === "RETURN"
            ) {
              const shopName =
                movement.shops_id
                  ? shopMap.get(
                      movement.shops_id
                    ) ?? "Shop"
                  : "Shop";

              const warehouseName =
                movement.warehouse_id_2
                  ? warehouseMap.get(
                      movement.warehouse_id_2
                    ) ??
                    "Warehouse"
                  : "Warehouse";

              from =
                createLocation(
                  movement.shops_id ??
                    "",
                  shopName,
                  "SHOP"
                );

              to =
                createLocation(
                  movement.warehouse_id_2 ??
                    "",
                  warehouseName,
                  "WAREHOUSE"
                );
            }

            /* -------------------------------------------------------------- */
            /* TRANSFER                                                         */
            /* -------------------------------------------------------------- */

            else {
              if (
                movement.warehouse_id
              ) {
                const warehouseName =
                  warehouseMap.get(
                    movement.warehouse_id
                  ) ??
                  "Warehouse";

                from =
                  createLocation(
                    movement.warehouse_id,
                    warehouseName,
                    "WAREHOUSE"
                  );
              } else if (
                movement.shops_id
              ) {
                const shopName =
                  shopMap.get(
                    movement.shops_id
                  ) ?? "Shop";

                from =
                  createLocation(
                    movement.shops_id,
                    shopName,
                    "SHOP"
                  );
              } else {
                from =
                  createLocation(
                    "",
                    "External",
                    "EXTERNAL"
                  );
              }

              if (
                movement.warehouse_id_2
              ) {
                const warehouseName =
                  warehouseMap.get(
                    movement.warehouse_id_2
                  ) ??
                  "Warehouse";

                to =
                  createLocation(
                    movement.warehouse_id_2,
                    warehouseName,
                    "WAREHOUSE"
                  );
              } else if (
                movement.shops_id_2
              ) {
                const shopName =
                  shopMap.get(
                    movement.shops_id_2
                  ) ?? "Shop";

                to =
                  createLocation(
                    movement.shops_id_2,
                    shopName,
                    "SHOP"
                  );
              } else {
                to =
                  createLocation(
                    "",
                    "External",
                    "EXTERNAL"
                  );
              }
            }

            return {
              id: movement.guid,
              merchantId: 
                movement.merchants_id,
              type,
              status,
              created_at:
                movement.created_at,
              items,
              from,
              to,
            };
          }
        );

      /* -------------------------------------------------------------------- */
      /* Shop Manager filter                                                   */
      /* -------------------------------------------------------------------- */

      const filteredByShop =
        normalizedMovements.filter(
          (movement) => {
            if (!shopId) {
              return true;
            }

            return (
              movement.from.id ===
                shopId ||
              movement.to.id ===
                shopId
            );
          }
        );

      setMovements(
        filteredByShop
      );

      /* -------------------------------------------------------------------- */
      /* Selected movement                                                     */
      /* -------------------------------------------------------------------- */

      if (
        keepSelected &&
        selectedMovement
      ) {
        const updatedMovement =
          filteredByShop.find(
            (movement) =>
              movement.id ===
              selectedMovement.id
          );

        if (updatedMovement) {
          setSelectedMovement(
            updatedMovement
          );
        }
      } else {
        setSelectedMovement(null);
      }
    } catch (error) {
      console.error(
        "Failed to load movements:",
        error
      );
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Callbacks                                                                */
  /* ------------------------------------------------------------------------ */

  async function handleMovementCreated() {
    await loadMovements();

    showSuccessToast(
      "Movement created successfully"
    );
  }

  async function handleMovementUpdated() {
    await loadMovements();

    showSuccessToast(
      "Movement updated successfully"
    );
  }

  async function handleMovementDeleted() {
    await loadMovements();

    showSuccessToast(
      "Movement deleted successfully"
    );
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
  /* Reload when merchant/shop changes                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    loadMovements();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, shopId]);

  /* ------------------------------------------------------------------------ */
  /* Detail                                                                   */
  /* ------------------------------------------------------------------------ */

  if (selectedMovement) {
    return (
      <div>
        <MovementDetail
          movement={
            selectedMovement
          }
          onBack={() =>
            setSelectedMovement(null)
          }
          onStatusUpdated={
            handleMovementStatusUpdated
          }
        />

        {toast && (
          <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
            {toast.type ===
            "success" ? (
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
  /* Filters                                                                  */
  /* ------------------------------------------------------------------------ */

  const normalizedSearch =
    search.trim().toLowerCase();

  const filteredMovements =
    movements.filter(
      (movement) => {
        if (
          filter !== "ALL" &&
          movement.type !== filter
        ) {
          return false;
        }

        if (
          statusFilter !== "ALL" &&
          movement.status !==
            statusFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const fromName =
          movement.from?.name
            ?.toLowerCase()
            .includes(
              normalizedSearch
            );

        const toName =
          movement.to?.name
            ?.toLowerCase()
            .includes(
              normalizedSearch
            );

        const movementId =
          movement.id
            ?.toLowerCase()
            .includes(
              normalizedSearch
            );

        return (
          fromName ||
          toName ||
          movementId
        );
      }
    );

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

  const total =
    movements.length;

  const draftCount =
    movements.filter(
      (movement) =>
        movement.status === "DRAFT"
    ).length;

  const acceptedCount =
    movements.filter(
      (movement) =>
        movement.status ===
        "ACCEPTED"
    ).length;

  const rejectedCount =
    movements.filter(
      (movement) =>
        movement.status ===
        "REJECTED"
    ).length;

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div>
      {toast && (
        <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
          {toast.type ===
          "success" ? (
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
          onClick={() =>
            setShowAddMovement(true)
          }
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus size={17} />
          New Movement
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total"
          value={total}
          icon={
            <Package size={18} />
          }
        />

        <SummaryCard
          label="Draft"
          value={draftCount}
          icon={
            <Clock3 size={18} />
          }
        />

        <SummaryCard
          label="Accepted"
          value={acceptedCount}
          icon={
            <CheckCircle2 size={18} />
          }
        />

        <SummaryCard
          label="Rejected"
          value={rejectedCount}
          icon={
            <XCircle size={18} />
          }
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search movements by location or ID..."
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(
                e.target.value as
                  | "ALL"
                  | MovementType
              )
            }
            className="h-10 min-w-[140px] appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400"
          >
            {TYPE_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <select
            value={
              statusFilter
            }
            onChange={(e) =>
              setStatusFilter(
                e.target.value as
                  | "ALL"
                  | MovementStatus
              )
            }
            className="h-10 min-w-[140px] appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-zinc-400"
          >
            {STATUS_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
            >
              <X size={15} />
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          Loading movements...
        </div>
      ) : filteredMovements.length ===
        0 ? (
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredMovements.map(
            (movement) => (
              <MovementCard
                key={
                  movement.id
                }
                movement={
                  movement
                }
                onClick={() =>
                  setSelectedMovement(
                    movement
                  )
                }
                onEdit={() =>
                  setEditingMovement(
                    movement
                  )
                }
                onDeleted={
                  handleMovementDeleted
                }
              />
            )
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add Movement                                                       */}
      {/* ------------------------------------------------------------------ */}

      {showAddMovement && (
        <AddMovementModal
          shops={shops}
          warehouses={warehouses}
          merchants={merchants}
          merchantId={merchantId}
          shopId={shopId}
          onClose={() =>
            setShowAddMovement(
              false
            )
          }
          onCreated={
            handleMovementCreated
          }
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Edit Movement                                                      */}
      {/* ------------------------------------------------------------------ */}

      {editingMovement && (
        <AddMovementModal
          shops={shops}
          warehouses={warehouses}
          merchants={merchants}
          merchantId={merchantId}
          shopId={shopId}
          movement={editingMovement}
          onClose={() =>
            setEditingMovement(
              null
            )
          }
          onCreated={
            handleMovementUpdated
          }
        />
      )}
    </div>
  );
}

export default Movements;