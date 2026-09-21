import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Plus,
  Search,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";

import {
  getCategories,
  deleteCategory,
} from "../api/categories";

import type { Category } from "../types/category";

import CategoryRow from "../components/categories/CategoryRow";
import CreateCategoryModal from "../components/categories/CreateCategoryModal";
import UpdateCategoryModal from "../components/categories/UpdateCategoryModal";

type CategoriesProps = {
  merchantId: string;
};

type Toast = {
  message: string;
};

function Categories({
  merchantId,
}: CategoriesProps) {
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [parentCategory, setParentCategory] =
    useState<Category | null>(null);

  const [editCategory, setEditCategory] =
    useState<Category | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  // =========================================================
  // DELETE
  // =========================================================

  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<Category | null>(null);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  // =========================================================
  // TOAST
  // =========================================================

  const [toast, setToast] =
    useState<Toast | null>(null);

  const showSuccessToast = useCallback(
    (message: string) => {
      setToast({
        message,
      });

      setTimeout(() => {
        setToast(null);
      }, 3000);
    },
    []
  );

  // =========================================================
  // LOAD CATEGORIES
  // =========================================================

  const loadCategories = useCallback(
    async (searchValue = "") => {
      try {
        setLoading(true);
        setError("");

        const response =
          await getCategories(
            merchantId,
            searchValue
          );

        setCategories(
          response.data.data.categories ?? []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load categories"
        );
      } finally {
        setLoading(false);
      }
    },
    [merchantId]
  );

  // =========================================================
  // EFFECTS
  // =========================================================

  useEffect(() => {
    setCategories([]);
    setSearch("");
    loadCategories();
  }, [merchantId, loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategories(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, loadCategories]);

  // =========================================================
  // DELETE CATEGORY
  // =========================================================

  function openDeleteCategoryModal(
    category: Category
  ) {
    setDeleteCategoryTarget(category);
    setDeleteError("");
  }

  function closeDeleteCategoryModal() {
    if (deleteLoading) {
      return;
    }

    setDeleteCategoryTarget(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleteCategoryTarget) {
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError("");

      await deleteCategory(
        deleteCategoryTarget.guid
      );

      await loadCategories(search);

      setDeleteCategoryTarget(null);
      setDeleteError("");

      showSuccessToast(
        "Category deleted successfully"
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete category"
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  // =========================================================
  // UPDATE CATEGORY
  // =========================================================

  async function handleCategoryUpdated() {
    await loadCategories(search);

    setEditCategory(null);

    showSuccessToast(
      "Category updated successfully"
    );
  }

  // =========================================================
  // CREATE CATEGORY
  // =========================================================

  async function handleCategoryCreated() {
    await loadCategories(search);

    setShowCreateModal(false);
    setParentCategory(null);

    showSuccessToast(
      "Category created successfully"
    );
  }

  // =========================================================
  // PARENT NAME
  // =========================================================

  function getParentName(
    category: Category
  ): string {
    if (!category.category_id) {
      return "Root";
    }

    const parent = categories.find(
      (item) =>
        item.guid === category.category_id
    );

    return parent?.name ?? "Unknown";
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <p className="text-sm text-zinc-500">
          Loading categories...
        </p>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">
          {error}
        </p>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div>
      {/* SUCCESS TOAST */}
      {toast && (
        <div className="fixed right-5 top-5 z-[500]">
          <div className="flex min-w-[300px] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2
                size={20}
                className="text-emerald-500"
              />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900">
                Success
              </p>

              <p className="mt-0.5 text-sm text-zinc-500">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setToast(null)
              }
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Categories
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage categories and subcategories
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setParentCategory(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus size={17} />
          Add
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search categories..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
          />
        </div>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm text-zinc-500">
            No categories found
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Category
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Parent
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Description
                  </th>

                  <th className="w-16 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {categories.map((category) => (
                  <CategoryRow
                    key={category.guid}
                    category={category}
                    parentName={getParentName(
                      category
                    )}
                    onAddSubcategory={() => {
                      setParentCategory(category);
                      setShowCreateModal(true);
                    }}
                    onEdit={() => {
                      setEditCategory(category);
                    }}
                    onDelete={() =>
                      openDeleteCategoryModal(
                        category
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCategoryModal
          merchantId={merchantId}
          categories={categories}
          parentCategory={parentCategory}
          onClose={() => {
            setShowCreateModal(false);
            setParentCategory(null);
          }}
          onCreated={
            handleCategoryCreated
          }
        />
      )}

      {/* Update Modal */}
      {editCategory && (
        <UpdateCategoryModal
          category={editCategory}
          categories={categories}
          onClose={() =>
            setEditCategory(null)
          }
          onUpdated={
            handleCategoryUpdated
          }
        />
      )}

      {/* Delete Category Modal */}
      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Delete Category
                </h2>

                <p className="mt-0.5 text-xs text-zinc-400">
                  This action cannot be undone
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeDeleteCategoryModal
                }
                disabled={deleteLoading}
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                <Trash2
                  size={20}
                  className="text-red-500"
                />
              </div>

              <h3 className="text-sm font-semibold text-zinc-800">
                Are you sure you want to
                delete this category?
              </h3>

              <div className="mt-3 rounded-lg bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">
                  {deleteCategoryTarget.name}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  All related data may be
                  affected.
                </p>
              </div>

              {/* Delete Error */}
              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">
                    {deleteError}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={
                  closeDeleteCategoryModal
                }
                disabled={deleteLoading}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} />

                {deleteLoading
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;