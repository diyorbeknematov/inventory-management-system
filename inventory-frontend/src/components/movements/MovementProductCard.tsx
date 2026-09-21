import {
  MoreVertical,
  Package,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  MovementItem,
  MovementStatus,
} from "../../types/movement";

import getImageUrls from "../../utils/image";
import { deleteStockMovementItem } from "../../api/movements";

export default function MovementProductCard({
  item,
  status,
  onDeleted,
}: {
  item: MovementItem;
  status: MovementStatus;
  onDeleted: () => Promise<void>;
}) {
  const images = getImageUrls(item.images);

  const [showMenu, setShowMenu] =
    useState(false);

  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      const target =
        event.target as HTMLElement;

      if (
        !target.closest(
          ".movement-product-menu"
        )
      ) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [showMenu]);

  function handleDeleteClick() {
    setShowMenu(false);
    setDeleteError("");
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    if (deleting) {
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      await deleteStockMovementItem({
        movement_item_id: item.guid,
      });

      setShowDeleteModal(false);

      await onDeleted();
    } catch (error) {
      console.error(
        "Failed to delete movement item:",
        error
      );

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete movement item"
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleCloseDeleteModal() {
    if (deleting) {
      return;
    }

    setShowDeleteModal(false);
    setDeleteError("");
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
        {/* Image */}
        <div className="relative">
          {images.length > 0 ? (
            <img
              src={images[0]}
              alt={item.product_name}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-zinc-50">
              <Package
                size={34}
                className="text-zinc-300"
              />
            </div>
          )}

          {/* Three dots */}
          {status === "DRAFT" && (
            <div className="movement-product-menu absolute right-3 top-3">
              <button
                type="button"
                onClick={() =>
                  setShowMenu(
                    (prev) => !prev
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-zinc-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-900"
                title="More"
              >
                <MoreVertical size={18} />
              </button>

              {/* Menu */}
              {showMenu && (
                <div className="absolute right-0 top-10 z-50 w-32 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={
                      handleDeleteClick
                    }
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900">
              {item.product_name}
            </h3>

            <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
              {item.quantity}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">
                SKU
              </span>

              <span className="truncate font-medium text-zinc-700">
                {item.sku || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">
                Size
              </span>

              <span className="font-medium text-zinc-700">
                {item.size || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-400">
                Color
              </span>

              {item.color ? (
                <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-zinc-300"
                    style={{
                      backgroundColor:
                        item.color,
                    }}
                  />

                  <span className="max-w-[100px] truncate">
                    {item.color}
                  </span>
                </span>
              ) : (
                <span className="font-medium text-zinc-400">
                  -
                </span>
              )}
            </div>
          </div>

          {/* Quantity */}
          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
            <span className="text-xs text-zinc-400">
              Quantity
            </span>

            <span className="text-sm font-semibold text-zinc-900">
              {item.quantity}
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Delete product
              </h2>

              <button
                type="button"
                onClick={
                  handleCloseDeleteModal
                }
                disabled={deleting}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              <p className="text-sm text-zinc-600">
                Are you sure you want to
                delete this product from the
                movement?
              </p>

              <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2.5">
                <p className="truncate text-sm font-medium text-zinc-800">
                  {item.product_name}
                </p>

                <p className="mt-0.5 text-xs text-zinc-400">
                  Quantity: {item.quantity}
                </p>
              </div>

              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-600">
                    {deleteError}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <button
                type="button"
                onClick={
                  handleCloseDeleteModal
                }
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleConfirmDelete
                }
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} />

                {deleting
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

