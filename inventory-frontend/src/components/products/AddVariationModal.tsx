import {
  useState,
} from "react";

import type {
  ChangeEvent,
} from "react";

import {
  Plus,
  X,
} from "lucide-react";

import { createProductVariation } from "../../api/product";
import { uploadImages } from "../../api/files";

export default function AddVariationModal({
  productId,
  onClose,
  onCreated,
}: {
  productId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [size, setSize] =
    useState("");

  const [color, setColor] =
    useState("");

  // Endi File[] emas, upload qilingan URL'lar saqlanadi
  const [images, setImages] =
    useState<string[]>([]);

  const [creating, setCreating] =
    useState(false);

  const [uploadingImages, setUploadingImages] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  // Rasm tanlanganda darhol upload qiladi
  const handleImages = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      e.target.files ?? []
    );

    if (files.length === 0) {
      return;
    }

    try {
      setError(null);
      setUploadingImages(true);

      const uploadedUrls =
        await uploadImages(files);

      // Yangi URL'larni oldingilariga qo'shamiz
      setImages((prev) => [
        ...prev,
        ...uploadedUrls,
      ]);
    } catch (error) {
      console.error(
        "Failed to upload images:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to upload images"
      );
    } finally {
      setUploadingImages(false);

      // Bir xil faylni yana tanlashga imkon beradi
      e.target.value = "";
    }
  };

  // Rasmni URL orqali o'chirish
  const removeImage = (
    index: number
  ) => {
    setImages((prev) =>
      prev.filter(
        (_, imageIndex) =>
          imageIndex !== index
      )
    );
  };

  const handleCreate =
    async () => {
      try {
        setError(null);

        setCreating(true);

        /* Create variation */

        const response =
          await createProductVariation({
            products_id: productId,

            ...(size.trim()
              ? {
                  size: size.trim(),
                }
              : {}),

            ...(color.trim()
              ? {
                  color: color.trim(),
                }
              : {}),

            // Bu yerda allaqachon upload qilingan URL'lar yuboriladi
            ...(images.length > 0
              ? {
                  images,
                }
              : {}),
          });

        /* Check response */

        if (
          response.status !==
            "success" &&
          response.data?.status !==
            "success"
        ) {
          throw new Error(
            response.custom_message ||
              response.description ||
              "Failed to create variation"
          );
        }

        /* Refresh product */

        await onCreated();

        onClose();
      } catch (error) {
        console.error(
          "Failed to create variation:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to create variation"
        );
      } finally {
        setCreating(false);
      }
    };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={
          creating ||
          uploadingImages
            ? undefined
            : onClose
        }
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          onClick={(e) =>
            e.stopPropagation()
          }
          className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div>
              <p className="text-xs text-zinc-400">
                Product variation
              </p>

              <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">
                Add Variation
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={
                creating ||
                uploadingImages
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            >
              <X size={19} />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-5 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Size + Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Size
                </label>

                <input
                  type="text"
                  value={size}
                  onChange={(e) =>
                    setSize(e.target.value)
                  }
                  placeholder="e.g. M"
                  disabled={
                    creating ||
                    uploadingImages
                  }
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Color
                </label>

                <input
                  type="text"
                  value={color}
                  onChange={(e) =>
                    setColor(e.target.value)
                  }
                  placeholder="e.g. Black"
                  disabled={
                    creating ||
                    uploadingImages
                  }
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                />
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="text-sm font-medium text-zinc-700">
                Images
              </label>

              <p className="mt-0.5 text-xs text-zinc-400">
                Optional
              </p>

              <input
                id="add-variation-images"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={
                  handleImages
                }
                disabled={
                  creating ||
                  uploadingImages
                }
              />

              <div className="mt-2 flex flex-wrap gap-3">
                {/* Uploaded images */}
                {images.map(
                  (url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                    >
                      <img
                        src={url}
                        alt={`Variation image ${
                          index + 1
                        }`}
                        className="h-full w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeImage(
                            index
                          )
                        }
                        disabled={
                          creating ||
                          uploadingImages
                        }
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                      >
                        <X
                          size={14}
                        />
                      </button>
                    </div>
                  )
                )}

                {/* Add image */}
                <label
                  htmlFor="add-variation-images"
                  className={`flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition ${
                    creating ||
                    uploadingImages
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  }`}
                >
                  {uploadingImages ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />

                      <span className="mt-1 text-[10px] font-medium">
                        Uploading...
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus size={20} />

                      <span className="mt-1 text-[11px] font-medium">
                        Add image
                      </span>
                    </>
                  )}
                </label>
              </div>

              {images.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500">
                  {images.length} image
                  {images.length !== 1
                    ? "s"
                    : ""}{" "}
                  uploaded
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={
                creating ||
                uploadingImages
              }
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleCreate
              }
              disabled={
                creating ||
                uploadingImages
              }
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : uploadingImages ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Uploading...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Variation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
