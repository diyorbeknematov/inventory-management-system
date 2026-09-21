import {
  ChevronRight,
  MapPin,
  Store,
} from "lucide-react";


import type { Shop } from "../../types/shop";

export default function ShopCard({
  shop,
  onClick,
}: {
  shop: Shop;
  onClick: () => void;
}) {
  const stocks = shop.stocks ?? [];

  const productCount = new Set(
    stocks.map((stock) => stock.product_id)
  ).size;

  const totalStock = stocks.reduce(
    (sum, stock) => sum + stock.quantity,
    0
  );

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex items-center justify-center bg-zinc-100 p-6">
        {shop.logo ? (
          <img
            src={shop.logo}
            alt={shop.name}
            className="h-24 w-24 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-zinc-200">
            <Store
              size={36}
              className="text-zinc-500"
            />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900">
              {shop.name}
            </h3>

            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
              <MapPin size={13} />

              <span className="truncate">
                {shop.address || "No address"}
              </span>
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
            {productCount}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
          <div>
            <p className="text-xs text-zinc-400">
              Products
            </p>

            <p className="mt-0.5 text-sm font-medium text-zinc-800">
              {productCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-400">
              Total stock
            </p>

            <p className="mt-0.5 text-sm font-medium text-zinc-800">
              {totalStock}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium text-zinc-500">
            View inventory
          </span>

          <ChevronRight
            size={16}
            className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700"
          />
        </div>
      </div>
    </div>
  );
}