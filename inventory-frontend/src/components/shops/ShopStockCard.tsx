import type { ShopStock } from "../../types/shop";

import getImageUrls from "../../utils/image";
import ImageCarousel from "../common/ImageCarousel";

export default function ShopStockCard({
  stock,
}: {
  stock: ShopStock;
}) {
  const images = getImageUrls(stock.images);

  const discountType =
    stock.discount_type?.[0];

  return (
    <div className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
      <ImageCarousel
        images={images}
        alt={stock.product_name}
        className="aspect-[4/3]"
      />

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900">
              {stock.product_name}
            </h3>

            <p className="mt-1 text-xs text-zinc-500">
              {stock.sku}
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {stock.quantity}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {stock.size && (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
              Size: {stock.size}
            </span>
          )}

          {stock.color ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
              <span>Color:</span>

              <span
                className="h-3.5 w-3.5 rounded-full border border-zinc-300"
                style={{
                  backgroundColor: stock.color,
                }}
              />

              {stock.color}
            </span>
          ) : (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-400">
              Color: -
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Base price
            </span>

            <span className="font-medium text-zinc-700">
              ${stock.base_price}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Discount
            </span>

            <span className="font-medium text-zinc-700">
              {discountType === "PERCENTAGE"
                ? `${stock.discount_value}%`
                : stock.discount_value}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
            <span className="text-xs font-medium text-zinc-500">
              Final price
            </span>

            <span className="text-sm font-semibold text-zinc-900">
              ${stock.final_price}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
