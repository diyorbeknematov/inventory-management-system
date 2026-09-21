import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import type { FrontendMovement } from "../../types/movement";

import {
  MovementTypeBadge,
  StatusBadge,
} from "../movements/MovementBadge";

import { MovementLocationView } from "./MovementDetail";

import { deleteStockMovement } from "../../api/movements";

export default function MovementCard({
  movement,
  onClick,
  onEdit,
  onDeleted,
}: {
  movement: FrontendMovement;
  onClick: () => void;
  onEdit: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  const variationCount = movement.items.length;

  const productCount = new Set(
    movement.items.map(
      (item) => item.product_id
    )
  ).size;

  const canEdit = movement.status === "DRAFT";

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setShowMenu(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [showMenu]);

  function handleCardClick() {
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    onClick();
  }

  function handleMenuClick(
    event: React.MouseEvent
  ) {
    event.stopPropagation();

    setShowMenu((prev) => !prev);
  }

  function handleEdit(
    event: React.MouseEvent
  ) {
    event.stopPropagation();

    setShowMenu(false);
    onEdit();
  }

  function handleDeleteClick(
    event: React.MouseEvent
  ) {
    event.stopPropagation();

    if (deleting) {
      return;
    }

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

      await deleteStockMovement({
        stock_movement_id: movement.id,
      });

      setShowDeleteModal(false);

      await onDeleted();
    } catch (error) {
      console.error(
        "Failed to delete stock movement:",
        error
      );

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete stock movement"
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
      <div
        onClick={handleCardClick}
        className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
      >
        {/* Top */}

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MovementTypeBadge
                type={movement.type}
              />

              <StatusBadge
                status={movement.status}
              />
            </div>
          </div>

          <div
            ref={menuRef}
            className="relative flex items-center gap-2"
          >
            {/* Three dots */}

            {canEdit && (
              <button
                type="button"
                onClick={handleMenuClick}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <MoreVertical size={18} />
              </button>
            )}

            {/* Dropdown */}

            {showMenu && canEdit && (
              <div className="absolute right-0 top-10 z-20 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                >
                  <Pencil size={15} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={15} />

                  {deleting
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            )}

            <ArrowRight
              size={18}
              className="shrink-0 text-zinc-300 transition group-hover:translate-x-1 group-hover:text-zinc-700"
            />
          </div>
        </div>

        {/* Route */}

        <div className="mb-5 rounded-lg bg-zinc-50 p-4">
          <div className="flex items-center gap-3">
            <MovementLocationView
              label="From"
              location={movement.from}
            />

            <ArrowRight
              size={18}
              className="shrink-0 text-zinc-400"
            />

            <MovementLocationView
              label="To"
              location={movement.to}
            />
          </div>
        </div>

        {/* Stats */}

        <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
          <div className="flex gap-5">
            <div>
              <p className="text-xs text-zinc-400">
                Products
              </p>

              <p className="mt-0.5 text-sm font-semibold text-zinc-800">
                {productCount}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-400">
                Variations
              </p>

              <p className="mt-0.5 text-sm font-semibold text-zinc-800">
                {variationCount}
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-zinc-400 transition group-hover:text-zinc-800">
            View details
          </span>
        </div>
      </div>

      {/* Delete Modal */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Delete movement
              </h2>

              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-zinc-600">
                Are you sure you want to
                delete this movement?
              </p>

              <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <MovementTypeBadge
                    type={movement.type}
                  />

                  <StatusBadge
                    status={movement.status}
                  />
                </div>
              </div>

              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-600">
                    {deleteError}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
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

