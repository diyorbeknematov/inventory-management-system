import {
  useEffect,
  useState,
  type ChangeEvent,
} from "react";

import { Plus, X } from "lucide-react";

import { updateShop } from "../../api/shops";
import { uploadImage } from "../../api/files";

import type { Shop } from "../../types/shop";

type UpdateShopModalProps = {
  shop: Shop;
  onClose: () => void;
  onUpdated: () => void;
};

export default function UpdateShopModal({
  shop,
  onClose,
  onUpdated,
}: UpdateShopModalProps) {
  const [name, setName] = useState(shop.name);
  const [logo, setLogo] = useState(shop.logo ?? "");
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [email, setEmail] = useState(shop.email ?? "");
  const [address, setAddress] = useState(shop.address ?? "");

  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(shop.name);
    setLogo(shop.logo ?? "");
    setPhone(shop.phone ?? "");
    setEmail(shop.email ?? "");
    setAddress(shop.address ?? "");
    setError("");
  }, [shop]);

  const handleLogo = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setError("");
      setUploadingLogo(true);

      const url = await uploadImage(file);

      setLogo(url);
    } catch (err) {
      console.error(
        "Failed to upload shop logo:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload shop logo"
      );
    } finally {
      setUploadingLogo(false);

      event.target.value = "";
    }
  };

  const removeLogo = () => {
    setLogo("");
  };

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Shop name is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await updateShop({
        shop_id: shop.guid,
        name: name.trim(),
        logo: logo.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });

      await onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update shop"
      );
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || uploadingLogo;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Edit Shop
            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">
              Update shop information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
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
              placeholder="Shop name"
              disabled={disabled}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50"
            />
          </div>

          {/* Logo */}

          <div>
            <label className="text-sm font-medium text-zinc-700">
              Logo
            </label>

            <p className="mt-0.5 text-xs text-zinc-400">
              Optional
            </p>

            <input
              id="update-shop-logo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogo}
              disabled={disabled}
            />

            <div className="mt-2 flex flex-wrap gap-3">
              {/* Current logo */}

              {logo && (
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  <img
                    src={logo}
                    alt="Shop logo"
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={removeLogo}
                    disabled={disabled}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Add / Change logo */}

              <label
                htmlFor="update-shop-logo"
                className={`flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                }`}
              >
                {uploadingLogo ? (
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
                      {logo
                        ? "Change logo"
                        : "Add logo"}
                    </span>
                  </>
                )}
              </label>
            </div>

            {logo && (
              <p className="mt-2 text-xs text-zinc-500">
                Logo uploaded
              </p>
            )}
          </div>

          {/* Phone */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Phone
            </label>

            <input
              type="text"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="+998 90 123 45 67"
              disabled={disabled}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50"
            />
          </div>

          {/* Email */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="shop@example.com"
              disabled={disabled}
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
              placeholder="Shop address"
              rows={3}
              disabled={disabled}
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
              disabled={disabled}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={disabled}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Updating..."
                : uploadingLogo
                ? "Uploading..."
                : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}