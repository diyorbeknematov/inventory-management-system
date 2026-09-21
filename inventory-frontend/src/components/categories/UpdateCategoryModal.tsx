import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { updateCategory } from "../../api/categories";
import type { Category } from "../../types/category";

type UpdateCategoryModalProps = {
  category: Category;
  categories: Category[];
  onClose: () => void;
  onUpdated: () => void;
};

export default function UpdateCategoryModal({
  category,
  categories,
  onClose,
  onUpdated,
}: UpdateCategoryModalProps) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(
    category.description
  );
  const [categoryId, setCategoryId] = useState(
    category.category_id ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(category.name);
    setDescription(category.description);
    setCategoryId(category.category_id ?? "");
    setError("");
  }, [category]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await updateCategory({
        guid: category.guid,
        name: name.trim(),
        description: description.trim(),
        category_id: categoryId || null,
      });

      onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update category"
      );
    } finally {
      setLoading(false);
    }
  }

  function isDescendant(
    categoryId: string,
    targetId: string
    ): boolean {
    const category = categories.find(
        (item) => item.guid === categoryId
    );

    if (!category?.category_id) {
        return false;
    }

    if (category.category_id === targetId) {
        return true;
    }

    return isDescendant(
        category.category_id,
        targetId
    );
    }

  const parentCategories = categories.filter(
    (item) =>
        item.guid !== category.guid &&
        !isDescendant(item.guid, category.guid)
    );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Edit Category
            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">
              Update category information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
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
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Category name"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Category description"
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400"
            />
          </div>

          {/* Parent */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Parent Category
            </label>

            <select
              value={categoryId}
              onChange={(e) =>
                setCategoryId(e.target.value)
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400"
            >
              <option value="">
                Root
              </option>

              {parentCategories.map((item) => (
                <option
                  key={item.guid}
                  value={item.guid}
                >
                  {item.name}
                </option>
              ))}
            </select>
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
              disabled={loading}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Updating..."
                : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}