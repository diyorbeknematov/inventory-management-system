import { useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Store,
  Phone,
  Trash2,
  X,
} from "lucide-react";

import {
  getMerchantShops,
  deleteShop,
} from "../api/shops";

import type {
  Shop,
  ShopStock,
} from "../types/shop";

import ShopCard from "../components/shops/ShopCard";
import ShopStockCard from "../components/shops/ShopStockCard";
import AddShopModal from "../components/shops/AddShopModal";
import AddShopStockModal from "../components/shops/AddShopStockModal";
import UpdateShopModal from "../components/shops/UpdateShopModal";

type ShopsProps = {
  merchantId: string;
  shopId?: string;
};

const normalizeStock = (
  stock: ShopStock
): ShopStock => ({
  ...stock,
  images: stock.images ?? [],
  discount_type:
    stock.discount_type ?? [],
});

const normalizeShop = (
  shop: Shop
): Shop => ({
  ...shop,
  stocks: (shop.stocks ?? []).map(
    normalizeStock
  ),
});

export default function Shops({
  merchantId,
  shopId,
}: ShopsProps) {
  const [shops, setShops] =
    useState<Shop[]>([]);

  const [selectedShop, setSelectedShop] =
    useState<Shop | null>(null);

  const [editShop, setEditShop] =
    useState<Shop | null>(null);

  const [deleteShopTarget, setDeleteShopTarget] =
    useState<Shop | null>(null);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const [toast, setToast] =
    useState<{ message: string } | null>(null);

  const [openShopMenu, setOpenShopMenu] =
    useState<string | null>(null);

  const shopMenuRef =
    useRef<HTMLDivElement>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [showAddShop, setShowAddShop] =
    useState(false);

  const [showAddStock, setShowAddStock] =
    useState(false);

  // Shops search
  const [search, setSearch] =
    useState("");

  // Selected shop ichidagi product search
  const [productSearch, setProductSearch] =
    useState("");

  async function loadShops(
    searchValue = ""
  ) {
    try {
      setLoading(true);
      setError(null);

      const response = await getMerchantShops(
        merchantId,
        shopId,
        searchValue
      );

      const data =
        response.data.data;

      const normalizedShops =
        (data.shops ?? []).map(
          normalizeShop
        );

      setShops(normalizedShops);

      // Shop Manager uchun
      // o'z shopini avtomatik ochamiz.
      if (shopId) {
        const ownShop =
          normalizedShops.find(
            (shop) => shop.guid === shopId
          );

        setSelectedShop(
          ownShop ?? null
        );

        return;
      }

      // Admin / Merchant uchun
      // oldingi tanlangan shopni saqlab qolamiz.
      setSelectedShop((current) => {
        if (!current) {
          return null;
        }

        return (
          normalizedShops.find(
            (shop) =>
              shop.guid === current.guid
          ) ?? null
        );
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load shops"
      );
    } finally {
      setLoading(false);
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

  function openDeleteShopModal(
    shop: Shop
  ) {
    setDeleteShopTarget(shop);
    setDeleteError("");
  }

  function closeDeleteShopModal() {
    if (deleteLoading) {
      return;
    }

    setDeleteShopTarget(null);
    setDeleteError("");
  }

  async function handleDeleteShop() {
    if (!deleteShopTarget) {
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError("");

      await deleteShop(
        deleteShopTarget.guid
      );

      await loadShops(search);

      setDeleteShopTarget(null);
      setDeleteError("");

      showSuccessToast(
        "Shop deleted successfully"
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete shop"
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleShopCreated() {
    await loadShops(search);

    setShowAddShop(false);

    showSuccessToast(
      "Shop created successfully"
    );
  }

  async function handleStockCreated() {
    await loadShops(search);

    setShowAddStock(false);

    showSuccessToast(
      "Stock added successfully"
    );
  }

  async function handleShopUpdated() {
    await loadShops(search);

    setEditShop(null);

    showSuccessToast(
      "Shop updated successfully"
    );
  }

  // Outside click -> Shop menu yopiladi
  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      if (
        shopMenuRef.current &&
        !shopMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpenShopMenu(null);
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

  // Initial load
  useEffect(() => {
    setSelectedShop(null);
    setSearch("");
    setProductSearch("");

    loadShops("");
  }, [merchantId, shopId]);

  // Shops search -> BACKEND
  useEffect(() => {
    if (shopId) {
      return;
    }

    const timer = setTimeout(() => {
      loadShops(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, merchantId, shopId]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-zinc-500">
          Loading shops...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  /*
   * SHOP MANAGER
   *
   * shopId mavjud bo'lsa,
   * ShopCard ro'yxatini ko'rsatmaymiz.
   *
   * Backenddan kelgan o'z shopini
   * to'g'ridan-to'g'ri ochamiz.
   */
  if (shopId && selectedShop) {
    const stocks =
      selectedShop.stocks ?? [];

    const filteredStocks =
      stocks.filter((stock) => {
        const query =
          productSearch
            .trim()
            .toLowerCase();

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

    const productCount = new Set(
      stocks.map(
        (stock) => stock.product_id
      )
    ).size;

    const variationCount =
      stocks.length;

    const totalStock =
      stocks.reduce(
        (sum, stock) =>
          sum + stock.quantity,
        0
      );

    return (
      <div>
        {/* Success Toast */}

        {toast && (
          <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
            <CheckCircle2
              size={19}
              className="text-green-600"
            />

            <p className="text-sm font-medium text-zinc-800">
              {toast.message}
            </p>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {selectedShop.logo ? (
                  <img
                    src={selectedShop.logo}
                    alt={selectedShop.name}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100">
                    <Store
                      size={25}
                      className="text-zinc-500"
                    />
                  </div>
                )}

                <div>
                  <h1 className="text-2xl font-semibold text-zinc-900">
                    {selectedShop.name}
                  </h1>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {selectedShop.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {selectedShop.address}
                      </span>
                    )}

                    {selectedShop.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} />
                        {selectedShop.phone}
                      </span>
                    )}

                    {selectedShop.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={13} />
                        {selectedShop.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddStock(true)
                }
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                <Plus size={17} />
                Add Stock
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">
                  Products
                </p>

                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {productCount}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">
                  Variations
                </p>

                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {variationCount}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">
                  Total stock
                </p>

                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {totalStock}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Product search - FRONTEND FILTER */}

        <div className="mb-5">
          <div className="relative max-w-md">
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
        </div>

        {filteredStocks.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
            <Boxes
              size={40}
              className="mx-auto text-zinc-300"
            />

            <p className="mt-3 text-sm font-medium text-zinc-700">
              {productSearch
                ? "No products found"
                : "No inventory available"}
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              {productSearch
                ? "No products match your search."
                : "This shop currently has no stock."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredStocks.map(
              (stock) => (
                <ShopStockCard
                  key={stock.variation_id}
                  stock={stock}
                />
              )
            )}
          </div>
        )}

        {showAddStock && (
          <AddShopStockModal
            shopId={selectedShop.guid}
            merchantId={merchantId}
            onClose={() =>
              setShowAddStock(false)
            }
            onCreated={handleStockCreated}
          />
        )}
      </div>
    );
  }

  /*
   * Agar Shop Manager uchun shop topilmasa.
   */
  if (shopId && !selectedShop) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
        <Store
          size={40}
          className="mx-auto text-zinc-300"
        />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          Shop not found
        </p>

        <p className="mt-1 text-xs text-zinc-400">
          Your assigned shop could not be found.
        </p>
      </div>
    );
  }

  /*
   * ADMIN / MERCHANT
   *
   * Tanlangan shop ichidagi stock.
   */
  if (selectedShop) {
    const stocks =
      selectedShop.stocks ?? [];

    const filteredStocks =
      stocks.filter((stock) => {
        const query =
          productSearch
            .trim()
            .toLowerCase();

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

    const productCount = new Set(
      stocks.map(
        (stock) => stock.product_id
      )
    ).size;

    const variationCount =
      stocks.length;

    const totalStock =
      stocks.reduce(
        (sum, stock) =>
          sum + stock.quantity,
        0
      );

    return (
      <div>
        {/* Success Toast */}

        {toast && (
          <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
            <CheckCircle2
              size={19}
              className="text-green-600"
            />

            <p className="text-sm font-medium text-zinc-800">
              {toast.message}
            </p>
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => {
              setSelectedShop(null);
              setProductSearch("");
            }}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            <ArrowLeft size={17} />
            Back to Shops
          </button>

          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {selectedShop.logo ? (
                  <img
                    src={selectedShop.logo}
                    alt={selectedShop.name}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100">
                    <Store
                      size={25}
                      className="text-zinc-500"
                    />
                  </div>
                )}

                <div>
                  <h1 className="text-2xl font-semibold text-zinc-900">
                    {selectedShop.name}
                  </h1>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {selectedShop.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />
                        {selectedShop.address}
                      </span>
                    )}

                    {selectedShop.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={13} />
                        {selectedShop.phone}
                      </span>
                    )}

                    {selectedShop.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={13} />
                        {selectedShop.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddStock(true)
                }
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                <Plus size={17} />
                Add Stock
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">
                  Products
                </p>

                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {productCount}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">
                  Variations
                </p>

                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {variationCount}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">
                  Total stock
                </p>

                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {totalStock}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Product search - FRONTEND FILTER */}

        <div className="mb-5">
          <div className="relative max-w-md">
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
        </div>

        {filteredStocks.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
            <Boxes
              size={40}
              className="mx-auto text-zinc-300"
            />

            <p className="mt-3 text-sm font-medium text-zinc-700">
              {productSearch
                ? "No products found"
                : "No inventory available"}
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              {productSearch
                ? "No products match your search."
                : "This shop currently has no stock."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredStocks.map(
              (stock) => (
                <ShopStockCard
                  key={stock.variation_id}
                  stock={stock}
                />
              )
            )}
          </div>
        )}

        {showAddStock && (
          <AddShopStockModal
            shopId={selectedShop.guid}
            merchantId={merchantId}
            onClose={() =>
              setShowAddStock(false)
            }
            onCreated={handleStockCreated}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Success Toast */}

      {toast && (
        <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2
            size={19}
            className="text-green-600"
          />

          <p className="text-sm font-medium text-zinc-800">
            {toast.message}
          </p>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Shops
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage shops and their inventory
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowAddShop(true)
          }
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus size={17} />
          Add Shop
        </button>
      </div>

      {/* Shops search - BACKEND */}

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
            placeholder="Search shops..."
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
          />
        </div>
      </div>

      {shops.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
          <Store
            size={40}
            className="mx-auto text-zinc-300"
          />

          <p className="mt-3 text-sm font-medium text-zinc-700">
            No shops found
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            {search
              ? "No shops match your search."
              : "Add your first shop to start managing inventory."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shops.map((shop) => (
            <div
              key={shop.guid}
              className="relative"
            >
              <ShopCard
                shop={shop}
                onClick={() => {
                  setProductSearch("");
                  setSelectedShop(shop);
                }}
              />

              {/* Shop actions */}

              <div
                ref={
                  openShopMenu === shop.guid
                    ? shopMenuRef
                    : null
                }
                className="absolute right-3 top-3 z-20"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenShopMenu(
                      (current) =>
                        current === shop.guid
                          ? null
                          : shop.guid
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-zinc-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-800"
                >
                  <MoreVertical size={17} />
                </button>

                {openShopMenu === shop.guid && (
                  <div className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenShopMenu(null);
                        setEditShop(shop);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                    >
                      <Pencil size={15} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenShopMenu(null);
                        openDeleteShopModal(
                          shop
                        );
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddShop && (
        <AddShopModal
          merchantId={merchantId}
          onClose={() =>
            setShowAddShop(false)
          }
          onCreated={handleShopCreated}
        />
      )}

      {editShop && (
        <UpdateShopModal
          shop={editShop}
          onClose={() =>
            setEditShop(null)
          }
          onUpdated={handleShopUpdated}
        />
      )}

      {/* Delete Shop Confirmation Modal */}

      {deleteShopTarget && (
        <>
          <div className="fixed inset-0 z-[280] bg-black/30 backdrop-blur-[2px]" />

          <div className="fixed inset-0 z-[290] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Delete shop
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Are you sure you want to delete this
                    shop?
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeDeleteShopModal
                  }
                  disabled={deleteLoading}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-900">
                  {deleteShopTarget.name}
                </p>

                {deleteShopTarget.address && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {deleteShopTarget.address}
                  </p>
                )}
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
                    closeDeleteShopModal
                  }
                  disabled={deleteLoading}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDeleteShop}
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