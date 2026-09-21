import { useState } from "react";

import { createWarehouse } from "../../api/warehouses";

type AddWarehouseModalProps = {
  merchantId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export default function AddWarehouseModal({
  merchantId,
  onClose,
  onCreated,
}: AddWarehouseModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setError("Warehouse name is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await createWarehouse({
        name: trimmedName,
        merchants_id: merchantId,
        ...(trimmedAddress
          ? { address: trimmedAddress }
          : {}),
      });

      if (
        response.status !== "success" &&
        response.data?.status !== "success"
      ) {
        throw new Error(
          response.custom_message ||
            response.description ||
            "Failed to create warehouse"
        );
      }

      await onCreated();
      onClose();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create warehouse"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]"
      />

      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-2xl">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Add Warehouse
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Create a new warehouse for this merchant.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-5"
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Warehouse name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Main Warehouse"
                  disabled={loading}
                  autoFocus
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Address
                </label>

                <input
                  type="text"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  placeholder="e.g. Tashkent, Chilanzar"
                  disabled={loading}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
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
                  ? "Creating..."
                  : "Create Warehouse"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
