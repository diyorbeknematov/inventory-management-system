import {
  Package,
  Pencil,
  Trash2,
} from "lucide-react";

import type { Variation } from "../../types/products";
import getImageUrls from "../../utils/image";

export default function VariationItem({
  variation,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  variation: Variation;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const images =
    getImageUrls(variation.images);

  return (
    <div
      className={`w-full rounded-xl border bg-white p-3 transition ${
        isSelected
          ? "border-zinc-900 ring-1 ring-zinc-900"
          : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 gap-3 text-left"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
            {images.length > 0 ? (
              <img
                src={images[0]}
                alt={variation.sku}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package
                  size={22}
                  strokeWidth={1.4}
                  className="text-zinc-300"
                />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {variation.sku}
            </p>

            <div className="mt-1 flex flex-wrap gap-2">
              {variation.size && (
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  Size: {variation.size}
                </span>
              )}

              {variation.color && (
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  Color: {variation.color}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Actions */}
        <div className="flex shrink-0 items-start gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Pencil size={15} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}