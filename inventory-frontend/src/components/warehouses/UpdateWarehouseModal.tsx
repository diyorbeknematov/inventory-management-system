import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { updateWarehouse } from "../../api/warehouses";
import type { Warehouse } from "../../types/warehouse";

type UpdateWarehouseModalProps = {
  warehouse: Warehouse;
  onClose: () => void;
  onUpdated: () => void;
};

export default function UpdateWarehouseModal({
  warehouse,
  onClose,
  onUpdated,
}: UpdateWarehouseModalProps) {
  const [name, setName] =
    useState(warehouse.name);

  const [address, setAddress] =
    useState(warehouse.address ?? "");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    setName(warehouse.name);
    setAddress(warehouse.address ?? "");
    setError("");
  }, [warehouse]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Warehouse name is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await updateWarehouse({
        warehouse_id: warehouse.guid,
        name: name.trim(),
        address: address.trim(),
      });

      await onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update warehouse"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Edit Warehouse
            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">
              Update warehouse information
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
              placeholder="Warehouse name"
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50"
            />
          </div>

          {/* Address */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Address
            </label>

            <textarea
              value={address}
              onChange={(event) =>
                setAddress(event.target.value)
              }
              placeholder="Warehouse address"
              rows={3}
              disabled={loading}
              className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50"
            />
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