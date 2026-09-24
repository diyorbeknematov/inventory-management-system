import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Package,
  Plus,
  ChevronRight,
  MapPin,
  Warehouse as WarehouseIcon,
  Boxes,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";

import {
  getWarehouses,
  getWarehouseStocks,
  deleteWarehouse,
} from "../api/warehouses";

import type {
  Warehouse,
  WarehouseStockItem,
} from "../types/warehouse";

import WarehouseStockCard from "../components/warehouses/WarehouseStockCard";
import AddWarehouseModal from "../components/warehouses/AddWarehouseModal";
import AddStockModal from "../components/warehouses/AddStockModal";
import UpdateWarehouseModal from "../components/warehouses/UpdateWarehouseModal";

type WarehousesProps = {
  merchantId?: string;
};

export default function Warehouses({
  merchantId,
}: WarehousesProps) {
  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [warehouseStocks, setWarehouseStocks] =
    useState<WarehouseStockItem[]>([]);

  const [stockLoading, setStockLoading] =
    useState(false);

  const [showAddWarehouseModal, setShowAddWarehouseModal] =
    useState(false);

  const [selectedWarehouseId, setSelectedWarehouseId] =
    useState<string | null>(null);

  const [showAddStockModal, setShowAddStockModal] =
    useState(false);

  const [editWarehouse, setEditWarehouse] =
    useState<Warehouse | null>(null);

  const [deleteWarehouseTarget, setDeleteWarehouseTarget] =
    useState<Warehouse | null>(null);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const [toast, setToast] =
    useState<{ message: string } | null>(null);

  const [openWarehouseMenu, setOpenWarehouseMenu] =
    useState<string | null>(null);

  const warehouseMenuRef =
    useRef<HTMLDivElement>(null);

  const [search, setSearch] =
    useState("");

  const [productSearch, setProductSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  async function loadWarehouses(
    searchValue = ""
  ) {
    try {
      setLoading(true);
      setError(null);

      const response =
        await getWarehouses(
          merchantId,
          searchValue
        );

      const data = response.data.data;

      const normalizedWarehouses =
        data.warehouses ?? [];

      setWarehouses(normalizedWarehouses);

      if (normalizedWarehouses.length > 0) {
        setSelectedWarehouseId((current) => {
          const stillExists =
            current &&
            normalizedWarehouses.some(
              (warehouse) =>
                warehouse.guid === current
            );

          return stillExists
            ? current
            : normalizedWarehouses[0].guid;
        });
      } else {
        setSelectedWarehouseId(null);
        setWarehouseStocks([]);
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load warehouses"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadWarehouseStocks(
    warehouseId: string
  ) {
    try {
      setStockLoading(true);

      const response =
        await getWarehouseStocks(
          warehouseId
        );

      setWarehouseStocks(
        response.data.data.stocks ?? []
      );
    } catch (err) {
      console.error(err);

      setWarehouseStocks([]);
    } finally {
      setStockLoading(false);
    }
  }

  function showSuccessToast(
    message: string
  ) {
    setToast({ message });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  function openDeleteWarehouseModal(
    warehouse: Warehouse
  ) {
    setDeleteWarehouseTarget(warehouse);
    setDeleteError("");
  }

  function closeDeleteWarehouseModal() {
    if (deleteLoading) {
      return;
    }

    setDeleteWarehouseTarget(null);
    setDeleteError("");
  }

  async function handleDeleteWarehouse() {
    if (!deleteWarehouseTarget) {
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError("");

      await deleteWarehouse(
        deleteWarehouseTarget.guid
      );

      await loadWarehouses(search);

      setDeleteWarehouseTarget(null);
      setDeleteError("");

      showSuccessToast(
        "Warehouse deleted successfully"
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete warehouse"
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleWarehouseCreated() {
    await loadWarehouses(search);

    setShowAddWarehouseModal(false);

    showSuccessToast(
      "Warehouse created successfully"
    );
  }

  async function handleStockCreated() {
    if (selectedWarehouseId) {
      await loadWarehouseStocks(
        selectedWarehouseId
      );
    }

    setShowAddStockModal(false);

    showSuccessToast(
      "Stock added successfully"
    );
  }

  async function handleWarehouseUpdated() {
    await loadWarehouses(search);

    setEditWarehouse(null);

    showSuccessToast(
      "Warehouse updated successfully"
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Reset warehouse selection when merchant changes                           */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    setSelectedWarehouseId(null);
    setProductSearch("");
    setWarehouseStocks([]);
  }, [merchantId]);

  /* -------------------------------------------------------------------------- */
  /* Load warehouses                                                            */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWarehouses(search);
    }, 300);

    return () => clearTimeout(timer);

    // loadWarehouses intentionally excluded
    // because it is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, merchantId]);

  /* -------------------------------------------------------------------------- */
  /* Load selected warehouse stocks                                             */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    setProductSearch("");

    if (selectedWarehouseId) {
      loadWarehouseStocks(
        selectedWarehouseId
      );
    } else {
      setWarehouseStocks([]);
    }
  }, [selectedWarehouseId]);

  /* -------------------------------------------------------------------------- */
  /* Close warehouse menu when clicking outside                                 */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      if (
        warehouseMenuRef.current &&
        !warehouseMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpenWarehouseMenu(null);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const selectedWarehouse =
    warehouses.find(
      (warehouse) =>
        warehouse.guid === selectedWarehouseId
    ) ?? null;

  const stocks = warehouseStocks;

  const filteredStocks = stocks.filter((stock) => {
    const query =
      productSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      stock.product_name
        ?.toLowerCase()
        .includes(query) ||
      stock.sku
        ?.toLowerCase()
        .includes(query)
    );
  });

  const totalStock = stocks.reduce(
    (sum, stock) =>
      sum + (Number(stock.quantity) || 0),
    0
  );

  const uniqueProducts = new Set(
    stocks.map((stock) => stock.product_id)
  ).size;

  const variationCount = stocks.length;

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <p className="text-sm text-zinc-500">
          Loading warehouses...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-medium text-red-700">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Success Toast */}

      {toast && (
        <div className="fixed right-5 top-5 z-[100] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2
            size={19}
            className="text-green-600"
          />

          <p className="text-sm font-medium text-zinc-800">
            {toast.message}
          </p>
        </div>
      )}

      {/* Header */}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Warehouses
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage your warehouses and inventory
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowAddWarehouseModal(true)
          }
          className="flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus size={17} />
          Add Warehouse
        </button>
      </div>

      {/* Main layout */}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Warehouse list */}

        <aside className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Warehouses
              </h2>

              <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                {warehouses.length}
              </span>
            </div>

            <div className="relative mt-3">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search warehouses..."
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2">
            {warehouses.map((warehouse) => {
              const isSelected =
                selectedWarehouseId ===
                warehouse.guid;

              return (
                <div
                  key={warehouse.guid}
                  className={`group relative mb-1 rounded-lg transition ${
                    isSelected
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWarehouseId(
                        warehouse.guid
                      );
                      setOpenWarehouseMenu(null);
                    }}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-white/10"
                            : "bg-zinc-100"
                        }`}
                      >
                        <WarehouseIcon
                          size={18}
                          strokeWidth={1.5}
                          className={
                            isSelected
                              ? "text-white"
                              : "text-zinc-500"
                          }
                        />
                      </div>

                      <div className="min-w-0 flex-1 pr-6">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isSelected
                              ? "text-white"
                              : "text-zinc-900"
                          }`}
                        >
                          {warehouse.name}
                        </p>

                        <div
                          className={`mt-1 flex items-center gap-1 text-xs ${
                            isSelected
                              ? "text-zinc-300"
                              : "text-zinc-500"
                          }`}
                        >
                          <MapPin size={11} />

                          <span className="truncate">
                            {warehouse.address ||
                              "No address"}
                          </span>
                        </div>
                      </div>

                      <ChevronRight
                        size={15}
                        className={
                          isSelected
                            ? "text-zinc-300"
                            : "text-zinc-400"
                        }
                      />
                    </div>
                  </button>

                  {/* Actions */}

                  <div
                    ref={
                      openWarehouseMenu ===
                      warehouse.guid
                        ? warehouseMenuRef
                        : null
                    }
                    className="absolute right-2 top-2 z-10"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenWarehouseMenu(
                          (current) =>
                            current === warehouse.guid
                              ? null
                              : warehouse.guid
                        )
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                        isSelected
                          ? "text-zinc-300 hover:bg-white/10 hover:text-white"
                          : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      }`}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openWarehouseMenu ===
                      warehouse.guid && (
                      <div className="absolute right-0 top-8 z-50 w-32 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenWarehouseMenu(null);
                            setEditWarehouse(
                              warehouse
                            );
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenWarehouseMenu(null);
                            openDeleteWarehouseModal(
                              warehouse
                            );
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Selected warehouse */}

        <main className="min-w-0">
          {!selectedWarehouse ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
              <div className="text-center">
                <WarehouseIcon
                  size={40}
                  strokeWidth={1.2}
                  className="mx-auto text-zinc-300"
                />

                <p className="mt-3 text-sm font-medium text-zinc-700">
                  Select a warehouse
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Warehouse info */}

              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                      <WarehouseIcon
                        size={27}
                        strokeWidth={1.3}
                        className="text-zinc-500"
                      />
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-zinc-900">
                        {selectedWarehouse.name}
                      </h2>

                      <div className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
                        <MapPin size={14} />

                        <span>
                          {selectedWarehouse.address ||
                            "No address"}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-zinc-400">
                        {uniqueProducts} products
                        {" · "}
                        {variationCount} variations
                      </p>
                    </div>
                  </div>

                  {/* Total stock */}

                  <div className="flex shrink-0 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                      <Boxes
                        size={19}
                        strokeWidth={1.5}
                        className="text-zinc-600"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-zinc-500">
                        Total Stock
                      </p>

                      <p className="mt-0.5 text-lg font-semibold text-zinc-900">
                        {totalStock.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock cards */}

              <div className="mt-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />

                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) =>
                        setProductSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search products..."
                      className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowAddStockModal(true)
                    }
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    <Plus size={17} />
                    Add Stock
                  </button>
                </div>

                {stockLoading ? (
                  <div className="flex min-h-[350px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
                    <p className="text-sm text-zinc-500">
                      Loading stock...
                    </p>
                  </div>
                ) : stocks.length === 0 ? (
                  <EmptyWarehouse />
                ) : filteredStocks.length === 0 ? (
                  <EmptyProductSearch />
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {filteredStocks.map((stock) => (
                      <WarehouseStockCard
                        key={stock.guid}
                        stock={stock}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Add Warehouse */}

      {showAddWarehouseModal && (
        <AddWarehouseModal
          merchantId={merchantId}
          onClose={() =>
            setShowAddWarehouseModal(false)
          }
          onCreated={handleWarehouseCreated}
        />
      )}

      {/* Add Stock */}

      {showAddStockModal &&
        selectedWarehouse && (
          <AddStockModal
            warehouseId={
              selectedWarehouse.guid
            }
            merchantId={
              selectedWarehouse.merchants_id
            }
            onClose={() =>
              setShowAddStockModal(false)
            }
            onCreated={handleStockCreated}
          />
        )}

      {/* Update Warehouse */}

      {editWarehouse && (
        <UpdateWarehouseModal
          warehouse={editWarehouse}
          onClose={() =>
            setEditWarehouse(null)
          }
          onUpdated={
            handleWarehouseUpdated
          }
        />
      )}

      {/* Delete Warehouse Confirmation Modal */}

      {deleteWarehouseTarget && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px]" />

          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Delete warehouse
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Are you sure you want to delete this
                    warehouse?
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeDeleteWarehouseModal
                  }
                  disabled={deleteLoading}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-900">
                  {
                    deleteWarehouseTarget.name
                  }
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {
                    deleteWarehouseTarget.address ||
                    "No address"
                  }
                </p>
              </div>

              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">
                    {deleteError}
                  </p>
                </div>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    closeDeleteWarehouseModal
                  }
                  disabled={deleteLoading}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    handleDeleteWarehouse
                  }
                  disabled={deleteLoading}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />

                  {deleteLoading
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyWarehouse() {
  return (
    <div className="flex min-h-[350px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
      <div className="text-center">
        <Package
          size={40}
          strokeWidth={1.2}
          className="mx-auto text-zinc-300"
        />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          No stock available
        </p>

        <p className="mt-1 text-xs text-zinc-400">
          This warehouse does not have any stock yet.
        </p>
      </div>
    </div>
  );
}

function EmptyProductSearch() {
  return (
    <div className="flex min-h-[350px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
      <div className="text-center">
        <Search
          size={40}
          strokeWidth={1.2}
          className="mx-auto text-zinc-300"
        />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          No products found
        </p>

        <p className="mt-1 text-xs text-zinc-400">
          Try searching by product name or SKU.
        </p>
      </div>
    </div>
  );
}