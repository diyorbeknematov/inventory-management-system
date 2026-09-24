import {
  useState,
  type MouseEvent,
} from "react";
import {
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import type { WarehouseStockItem } from "../../types/warehouse";

import getImageUrls from "../../utils/image";

export default function WarehouseStockCard({
  stock,
}: {
  stock: WarehouseStockItem;
}) {
  const images = getImageUrls(
    stock.variation_images
  );

  const [currentImage, setCurrentImage] =
    useState(0);

  const hasMultipleImages =
    images.length > 1;

  const previousImage = (
    event: MouseEvent
  ) => {
    event.stopPropagation();

    setCurrentImage((prev) =>
      prev === 0
        ? images.length - 1
        : prev - 1
    );
  };

  const nextImage = (
    event: MouseEvent
  ) => {
    event.stopPropagation();

    setCurrentImage((prev) =>
      prev === images.length - 1
        ? 0
        : prev + 1
    );
  };

  const quantity =
    Number(stock.quantity) || 0;

  return (
    <div className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
      {/* Image carousel */}

      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {images.length > 0 ? (
          <img
            src={images[currentImage]}
            alt={stock.product_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package
              size={42}
              strokeWidth={1.2}
              className="text-zinc-300"
            />
          </div>
        )}

        {hasMultipleImages && (
          <>
            <button
              onClick={previousImage}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white"
            >
              <ChevronLeft size={17} />
            </button>

            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white"
            >
              <ChevronRight size={17} />
            </button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCurrentImage(index);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentImage
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/60"
                  }`}
                />
              ))}
            </div>

            <div className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white">
              {currentImage + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {/* Content */}

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900">
              {stock.product_name}
            </h3>

            <p className="mt-1 truncate text-xs text-zinc-500">
              {stock.sku}
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
            {quantity.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {stock.size ? (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
              Size: {stock.size}
            </span>
          ) : (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-400">
              Size: -
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

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium text-zinc-500">
            Stock quantity
          </span>

          <span className="text-xs font-semibold text-zinc-900">
            {quantity.toLocaleString()} units
          </span>
        </div>
      </div>
    </div>
  );
}
