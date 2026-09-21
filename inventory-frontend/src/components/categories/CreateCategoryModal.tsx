import { useState } from "react";
import { X } from "lucide-react";

import { createCategory } from "../../api/categories";
import type { Category } from "../../types/category";

type CreateCategoryModalProps = {
  merchantId: string;
  categories: Category[];
  parentCategory: Category | null;
  onCreated: () => Promise<void>;
  onClose: () => void;
};

export default function CreateCategoryModal({
  merchantId,
  categories,
  parentCategory,
  onCreated,
  onClose,
}: CreateCategoryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const [parentId, setParentId] = useState(
    parentCategory?.guid ?? ""
  );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    try {
      setError(null);

      if (!name.trim()) {
        setError(
          "Category name is required"
        );
        return;
      }

      setLoading(true);

      const response =
        await createCategory({
          name: name.trim(),
          description: description.trim(),
          category_id:
            parentId || null,
          merchants_id: merchantId,
        });

      // Agar API success status qaytarmasa
      if (
        response.status !== "success" &&
        response.data?.status !== "success"
      ) {
        throw new Error(
          response.custom_message ||
            response.description ||
            "Failed to create category"
        );
      }

      await onCreated();
      onClose();
    } catch (err) {
      console.error(
        "Failed to create category:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create category"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {parentCategory
                ? "Add Subcategory"
                : "Add Category"}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Create a new category
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);

                  if (error) {
                    setError(null);
                  }
                }}
                placeholder="Enter category name"
                disabled={loading}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Enter description"
                rows={4}
                disabled={loading}
                className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
              />
            </div>

            {/* Parent */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Parent category
              </label>

              <select
                value={parentId}
                onChange={(event) =>
                  setParentId(
                    event.target.value
                  )
                }
                disabled={loading}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
              >
                <option value="">
                  Root
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={category.guid}
                      value={category.guid}
                    >
                      {category.name}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
