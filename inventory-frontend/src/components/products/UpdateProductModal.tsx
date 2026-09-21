import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { updateProduct } from "../../api/product";
import { uploadImages } from "../../api/files";

import type {
  Category,
  Product,
} from "../../types/products";

type UpdateProductModalProps = {
  product: Product;
  categories: Category[];
  onClose: () => void;
  onUpdated: () => void;
};

export default function UpdateProductModal({
  product,
  categories,
  onClose,
  onUpdated,
}: UpdateProductModalProps) {
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(
    product.category_id ?? ""
  );

  const [images, setImages] = useState<string[]>(
    product.images ?? []
  );

  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(product.name);
    setCategoryId(product.category_id ?? "");
    setImages(product.images ?? []);
    setError("");
  }, [product]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    if (!categoryId) {
      setError("Category is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await updateProduct({
        product_id: product.guid,
        name: name.trim(),
        category_id: categoryId,
        images,
      });

      onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update product"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleImages(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    if (files.length === 0) {
      return;
    }

    try {
      setError("");
      setUploadingImages(true);

      const urls = await uploadImages(files);

      setImages((current) => [
        ...current,
        ...urls,
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload product images"
      );
    } finally {
      setUploadingImages(false);

      event.target.value = "";
    }
  }

  function removeImage(index: number) {
    setImages((current) =>
      current.filter(
        (_, imageIndex) => imageIndex !== index
      )
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Edit Product
            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">
              Update product information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading || uploadingImages}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-5"
        >
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Product name"
              disabled={loading || uploadingImages}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 disabled:bg-zinc-50"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Category
            </label>

            <select
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value)
              }
              disabled={loading || uploadingImages}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 disabled:bg-zinc-50"
            >
              <option value="">
                Select category
              </option>

              {categories.map((category) => (
                <CategoryOptions
                  key={category.guid}
                  category={category}
                />
              ))}
            </select>
          </div>

          {/* Images */}
          <div>
            <div className="mb-2">
              <label className="text-sm font-medium text-zinc-700">
                Product images
              </label>

              <p className="mt-0.5 text-xs text-zinc-400">
                Add or remove product images
              </p>
            </div>

            <input
              id="update-product-images"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImages}
              disabled={loading || uploadingImages}
            />

            <div className="flex flex-wrap gap-3">
              {/* Existing + new images */}
              {images.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="group relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeImage(index)
                    }
                    disabled={
                      loading || uploadingImages
                    }
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              {/* Add image */}
              <label
                htmlFor="update-product-images"
                className={`flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition ${
                  loading || uploadingImages
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
                {images.length > 1 ? "s" : ""}{" "}
                selected
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || uploadingImages}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || uploadingImages}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryOptions({
  category,
  level = 0,
}: {
  category: Category;
  level?: number;
}) {
  return (
    <>
      <option value={category.guid}>
        {"— ".repeat(level)}
        {category.name}
      </option>

      {(category.subcategories ?? []).map(
        (subcategory) => (
          <CategoryOptions
            key={subcategory.guid}
            category={subcategory}
            level={level + 1}
          />
        )
      )}
    </>
  );
}