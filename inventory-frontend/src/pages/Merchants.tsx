import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  X,
  CheckCircle2,
} from "lucide-react";

import {
  createMerchant,
  deleteMerchant,
  getMerchants,
  updateMerchant,
} from "../api/merchants";

import type { Merchant } from "../types/merchant";

type MerchantsProps = {
  onMerchantsChange?: (merchants: Merchant[]) => void;
};

export default function Merchants({
  onMerchantsChange,
}: MerchantsProps) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] =
    useState<Merchant | null>(null);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [deleteMerchantItem, setDeleteMerchantItem] =
    useState<Merchant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [successToast, setSuccessToast] = useState("");

  const loadMerchants = async () => {
    try {
      setLoading(true);

      const response = await getMerchants();

      const updatedMerchants =
        response.data.data.merchants;

      setMerchants(updatedMerchants);

      onMerchantsChange?.(updatedMerchants);
    } catch (error) {
      console.error("Failed to load merchants:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMerchants();
  }, []);

  const showSuccessToast = (message: string) => {
    setSuccessToast(message);

    setTimeout(() => {
      setSuccessToast("");
    }, 3000);
  };

  const openCreateModal = () => {
    setEditingMerchant(null);
    setName("");
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setName(merchant.name);
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setIsModalOpen(false);
    setEditingMerchant(null);
    setName("");
    setError("");
  };

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Merchant name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingMerchant) {
        const response = await updateMerchant({
          merchant_id: editingMerchant.guid,
          name: trimmedName,
        });

        console.log(
          "UPDATE MERCHANT RESPONSE:",
          response
        );

        const isSuccess =
          response.status === "success" ||
          response.data?.status === "success";

        if (!isSuccess) {
          throw new Error(
            response.custom_message ||
              response.data?.data?.message ||
              "Failed to update merchant"
          );
        }

        showSuccessToast(
          "Merchant updated successfully"
        );
      } else {
        const response = await createMerchant({
          name: trimmedName,
        });

        console.log(
          "CREATE MERCHANT RESPONSE:",
          response
        );

        const isSuccess =
          response.status === "success" ||
          response.data?.status === "success";

        if (!isSuccess) {
          throw new Error(
            response.custom_message ||
              response.data?.data?.message ||
              "Failed to create merchant"
          );
        }

        showSuccessToast(
          "Merchant created successfully"
        );
      }

      closeModal();

      await loadMerchants();
    } catch (error) {
      console.error(
        "Merchant save failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMerchantItem) return;

    try {
      setDeleting(true);

      const response = await deleteMerchant({
        merchant_id: deleteMerchantItem.guid,
      });

      console.log(
        "DELETE MERCHANT RESPONSE:",
        response
      );

      const isSuccess =
        response.status === "success" ||
        response.data?.status === "success";

      if (!isSuccess) {
        throw new Error(
          response.custom_message ||
            response.data?.data?.message ||
            "Failed to delete merchant"
        );
      }

      showSuccessToast(
        "Merchant deleted successfully"
      );

      setDeleteMerchantItem(null);

      await loadMerchants();
    } catch (error) {
      console.error(
        "Merchant delete failed:",
        error
      );

      setDeleteMerchantItem(null);

      showSuccessToast(
        error instanceof Error
          ? error.message
          : "Failed to delete merchant"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">
              Merchants
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your merchants
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus size={17} />
            Add Merchant
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <p className="text-sm text-slate-500">
                Loading merchants...
              </p>
            </div>
          ) : merchants.length === 0 ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Building2
                  size={26}
                  className="text-slate-500"
                />
              </div>

              <h2 className="text-base font-semibold text-slate-800">
                No merchants yet
              </h2>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Create your first merchant to start
                managing inventory.
              </p>

              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus size={17} />
                Add Merchant
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl">
              <div className="grid grid-cols-[1fr_180px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>Merchant</span>

                <span className="text-right">
                  Actions
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {merchants.map((merchant) => (
                  <div
                    key={merchant.guid}
                    className="grid grid-cols-[1fr_180px] items-center px-5 py-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                        <Building2
                          size={19}
                          className="text-slate-500"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {merchant.name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-400">
                          {merchant.guid}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(merchant)
                        }
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteMerchantItem(
                            merchant
                          )
                        }
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {editingMerchant
                    ? "Edit Merchant"
                    : "Add Merchant"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {editingMerchant
                    ? "Update merchant information"
                    : "Create a new merchant"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Merchant name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSave();
                  }
                }}
                placeholder="Enter merchant name"
                autoFocus
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              />

              {error && (
                <p className="mt-2 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingMerchant
                    ? "Save Changes"
                    : "Create Merchant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteMerchantItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                <Trash2
                  size={20}
                  className="text-red-600"
                />
              </div>

              <h2 className="text-base font-semibold text-slate-800">
                Delete merchant?
              </h2>

              <p className="mt-2 text-sm leading-5 text-slate-500">
                Are you sure you want to delete{" "}
                <span className="font-medium text-slate-700">
                  {deleteMerchantItem.name}
                </span>
                ?
              </p>

              <p className="mt-2 text-xs text-slate-400">
                A merchant with related data cannot be
                deleted.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  setDeleteMerchantItem(null)
                }
                disabled={deleting}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successToast && (
        <div className="fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700 shadow-lg">
          <CheckCircle2
            size={18}
            className="text-emerald-500"
          />

          {successToast}
        </div>
      )}
    </>
  );
}
