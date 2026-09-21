import {
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Product } from "../../types/products";
import ImageCarousel from "../common/ImageCarousel";
import getImageUrls from "../../utils/image";

export default function ProductCard({
  product,
  onClick,
  onEdit,
  onDelete,
}: {
  product: Product;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const variations =
    product.variations ?? [];

  const images =
    getImageUrls(
      product.images
    );

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setMenuOpen(false);
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

  return (
    <div
      onClick={() => {
        if (menuOpen) {
          return;
        }

        onClick();
      }}
      className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div className="relative">
        <ImageCarousel
          images={images}
          alt={product.name}
          className="aspect-[4/3]"
        />

        {/* Actions */}
        <div
          ref={menuRef}
          className="absolute right-3 top-3 z-20"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <button
            type="button"
            onClick={() =>
              setMenuOpen(
                (current) => !current
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-zinc-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-800"
          >
            <MoreVertical size={17} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                <Pencil size={15} />
                Edit
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
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

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900">
            {product.name}
          </h3>

          <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
            {variations.length}
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          {variations.length === 0
            ? "No variations"
            : variations.length === 1
            ? "1 variation"
            : `${variations.length} variations`}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium text-zinc-500">
            View details
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