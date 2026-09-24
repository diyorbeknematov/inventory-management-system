import {
  useState,
} from "react";

import {
  Package,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import type {
  Product,
  Variation,
} from "../../types/products";

import ImageCarousel from "../common/ImageCarousel";
import VariationItem from "../products/VariationItem";
import AddVariationModal from "../products/AddVariationModal";
import UpdateVariationModal from "../products/UpdateVariationModal";

import getImageUrls from "../../utils/image";

import {
  deleteProductVariation,
} from "../../api/product";

export default function ProductDetailsDrawer({
  product,
  variations,
  variationLoading,
  onClose,
  onVariationCreated,
  onSuccess,
}: {
  product: Product;
  variations: Variation[];
  variationLoading: boolean;
  onClose: () => void;
  onVariationCreated: () => Promise<void>;
  onSuccess: (message: string) => void;
}) {
  const productImages =
    getImageUrls(product.images);

  const [
    selectedVariationId,
    setSelectedVariationId,
  ] = useState<string | null>(null);

  const [
    showAddVariationModal,
    setShowAddVariationModal,
  ] = useState(false);

  const [
    editVariation,
    setEditVariation,
  ] = useState<Variation | null>(null);

  const [
    deleteVariation,
    setDeleteVariation,
  ] = useState<Variation | null>(null);

  const [
    deletingVariation,
    setDeletingVariation,
  ] = useState(false);

  const [
    deleteError,
    setDeleteError,
  ] = useState("");

  const selectedVariation =
    variations.find(
      (variation) =>
        variation.guid ===
        selectedVariationId
    ) ?? null;

  const variationImages =
    selectedVariation
      ? getImageUrls(
          selectedVariation.images
        )
      : [];

  const displayedImages =
    variationImages.length > 0
      ? variationImages
      : productImages;

  const handleDeleteVariation =
    async () => {
      if (!deleteVariation) {
        return;
      }

      try {
        setDeletingVariation(true);
        setDeleteError("");

        const response =
          await deleteProductVariation({
            variation_id:
              deleteVariation.guid,
          });

        if (
          response.status !==
            "success" &&
          response.data?.status !==
            "success"
        ) {
          throw new Error(
            response.custom_message ||
              response.description ||
              "Failed to delete variation"
          );
        }

        await onVariationCreated();

        setDeleteVariation(null);
        setDeleteError("");

        onSuccess(
          "Variation deleted successfully"
        );
      } catch (error) {
        console.error(
          "Failed to delete variation:",
          error
        );

        setDeleteError(
          error instanceof Error
            ? error.message
            : "Failed to delete variation"
        );
      } finally {
        setDeletingVariation(false);
      }
    };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs text-zinc-400">
              Product details
            </p>

            <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">
              {product.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-5">
          {/* Product image */}
          <ImageCarousel
            images={displayedImages}
            alt={
              selectedVariation?.sku ??
              product.name
            }
            className="aspect-[4/3] rounded-xl"
          />

          {/* Selected variation */}
          {selectedVariation && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs text-zinc-500">
                Selected variation
              </p>

              <p className="mt-1 text-sm font-semibold text-zinc-900">
                {selectedVariation.sku}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {selectedVariation.size && (
                  <span className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600">
                    Size:{" "}
                    {selectedVariation.size}
                  </span>
                )}

                {selectedVariation.color && (
                  <span className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600">
                    Color:{" "}
                    {selectedVariation.color}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Variations */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Variations
                </h3>

                {!variationLoading && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {variations.length} variation
                    {variations.length !== 1
                      ? "s"
                      : ""}
                  </p>
                )}
              </div>

              {/* ADD VARIATION */}
              <button
                type="button"
                onClick={() =>
                  setShowAddVariationModal(
                    true
                  )
                }
                disabled={variationLoading}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} />
                Add variation
              </button>
            </div>

            {/* Loading */}
            {variationLoading ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />

                <p className="mt-3 text-sm text-zinc-500">
                  Loading variations...
                </p>
              </div>
            ) : variations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center">
                <Package
                  size={28}
                  strokeWidth={1.4}
                  className="mx-auto text-zinc-300"
                />

                <p className="mt-2 text-sm font-medium text-zinc-700">
                  No variations
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  This product does not have
                  any variations yet.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddVariationModal(
                      true
                    )
                  }
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
                >
                  <Plus size={14} />
                  Add variation
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {variations.map(
                  (variation) => (
                    <VariationItem
                      key={
                        variation.guid
                      }
                      variation={
                        variation
                      }
                      isSelected={
                        variation.guid ===
                        selectedVariationId
                      }
                      onSelect={() =>
                        setSelectedVariationId(
                          (prev) =>
                            prev ===
                            variation.guid
                              ? null
                              : variation.guid
                        )
                      }
                      onEdit={() =>
                        setEditVariation(
                          variation
                        )
                      }
                      onDelete={() => {
                        setDeleteError("");
                        setDeleteVariation(
                          variation
                        );
                      }}
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Add Variation Modal */}
      {showAddVariationModal && (
        <AddVariationModal
          productId={product.guid}
          onClose={() =>
            setShowAddVariationModal(
              false
            )
          }
          onCreated={async () => {
            await onVariationCreated();

            setShowAddVariationModal(
              false
            );

            onSuccess(
              "Variation added successfully"
            );
          }}
        />
      )}

      {/* Update Variation Modal */}
      {editVariation && (
        <UpdateVariationModal
          variation={editVariation}
          onClose={() =>
            setEditVariation(null)
          }
          onUpdated={async () => {
            await onVariationCreated();

            setEditVariation(null);

            onSuccess(
              "Variation updated successfully"
            );
          }}
        />
      )}

      {/* Delete Variation Modal */}
      {deleteVariation && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px]" />

          {/* Modal */}
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                <div>
                  <p className="text-xs text-zinc-400">
                    Product variation
                  </p>

                  <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">
                    Delete Variation
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDeleteVariation(null)
                  }
                  disabled={
                    deletingVariation
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
                >
                  <X size={19} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5">
                {deleteError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">
                      {deleteError}
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {deleteVariation.sku}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {deleteVariation.size && (
                      <span className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600">
                        Size:{" "}
                        {
                          deleteVariation.size
                        }
                      </span>
                    )}

                    {deleteVariation.color && (
                      <span className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600">
                        Color:{" "}
                        {
                          deleteVariation.color
                        }
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-sm text-zinc-600">
                  Are you sure you want to
                  delete this variation?
                  This action cannot be
                  undone.
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() =>
                    setDeleteVariation(null)
                  }
                  disabled={
                    deletingVariation
                  }
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    handleDeleteVariation
                  }
                  disabled={
                    deletingVariation
                  }
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingVariation ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      Delete Variation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
