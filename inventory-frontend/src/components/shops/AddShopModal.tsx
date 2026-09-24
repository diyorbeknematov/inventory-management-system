import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Plus, X } from "lucide-react";

import { createShop } from "../../api/shops";
import { uploadImage } from "../../api/files";
import { getMerchants } from "../../api/merchants";

import type { Merchant } from "../../types/merchant";

type AddShopModalProps = {
  merchantId?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export default function AddShopModal({
  merchantId,
  onClose,
  onCreated,
}: AddShopModalProps) {
  const [name, setName] =
    useState("");

  // Admin + All merchants holatida
  // shu yerdan merchant tanlanadi.
  const [merchants, setMerchants] =
    useState<Merchant[]>([]);

  const [selectedMerchantId, setSelectedMerchantId] =
    useState("");

  const [loadingMerchants, setLoadingMerchants] =
    useState(false);

  // Endi File emas, upload qilingan URL saqlanadi
  const [logo, setLogo] =
    useState<string>("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [uploadingLogo, setUploadingLogo] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    // Agar tashqaridan merchantId berilgan bo'lsa,
    // selector kerak emas.
    if (merchantId) {
      setSelectedMerchantId(merchantId);
      return;
    }

    async function loadMerchants() {
      try {
        setLoadingMerchants(true);
        setError(null);

        const response =
          await getMerchants();

        setMerchants(
          response.data.data.merchants ?? []
        );
      } catch (err) {
        console.error(
          "Failed to load merchants:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load merchants"
        );
      } finally {
        setLoadingMerchants(false);
      }
    }

    loadMerchants();
  }, [merchantId]);

  const handleLogo = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setError(null);
      setUploadingLogo(true);

      // Logo tanlanishi bilan darhol upload
      const url =
        await uploadImage(file);

      // Serverdan qaytgan URL
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

      // Bir xil faylni qayta tanlashga imkon beradi
      event.target.value = "";
    }
  };

  const removeLogo = () => {
    setLogo("");
  };

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError(
        "Shop name is required"
      );
      return;
    }

    const finalMerchantId =
      merchantId || selectedMerchantId;

    if (!finalMerchantId) {
      setError(
        "Please select a merchant"
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Logo allaqachon upload qilingan.
      // Bu yerda qayta upload qilinmaydi.
      await createShop({
        name: name.trim(),
        merchants_id: finalMerchantId,

        ...(logo
          ? {
              logo,
            }
          : {}),

        ...(phone.trim()
          ? {
              phone: phone.trim(),
            }
          : {}),

        ...(email.trim()
          ? {
              email: email.trim(),
            }
          : {}),

        ...(address.trim()
          ? {
              address:
                address.trim(),
            }
          : {}),
      });

      await onCreated();
      onClose();
    } catch (err) {
      console.error(
        "Failed to create shop:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create shop"
      );
    } finally {
      setLoading(false);
    }
  }

  const disabled =
    loading ||
    uploadingLogo ||
    loadingMerchants;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={
          disabled
            ? undefined
            : onClose
        }
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          onClick={(event) =>
            event.stopPropagation()
          }
          className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div>
              <p className="text-xs text-zinc-400">
                Shop
              </p>

              <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">
                Add Shop
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            >
              <X size={19} />
            </button>
          </div>

          {/* Body */}
          <form
            onSubmit={handleSubmit}
            className="space-y-4 px-5 py-5"
          >
            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Merchant */}
            {!merchantId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Merchant
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <select
                  value={selectedMerchantId}
                  onChange={(event) => {
                    setSelectedMerchantId(
                      event.target.value
                    );

                    if (error) {
                      setError(null);
                    }
                  }}
                  disabled={disabled}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                >
                  <option value="">
                    {loadingMerchants
                      ? "Loading merchants..."
                      : "Select merchant"}
                  </option>

                  {!loadingMerchants &&
                    merchants.map(
                      (merchant) => (
                        <option
                          key={merchant.guid}
                          value={merchant.guid}
                        >
                          {merchant.name}
                        </option>
                      )
                    )}
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Name
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(
                    event.target.value
                  );

                  if (error) {
                    setError(null);
                  }
                }}
                placeholder="Shop name"
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
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
                id="add-shop-logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogo}
                disabled={disabled}
              />

              <div className="mt-2 flex flex-wrap gap-3">
                {/* Logo preview */}
                {logo && (
                  <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                    <img
                      src={logo}
                      alt="Shop logo"
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={
                        removeLogo
                      }
                      disabled={disabled}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Add logo */}
                <label
                  htmlFor="add-shop-logo"
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
                  setPhone(
                    event.target.value
                  )
                }
                placeholder="+998 ..."
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
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
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="shop@example.com"
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
              />
            </div>

            {/* Address */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Address
              </label>

              <input
                type="text"
                value={address}
                onChange={(event) =>
                  setAddress(
                    event.target.value
                  )
                }
                placeholder="Shop address"
                disabled={disabled}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:bg-zinc-50"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={disabled}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={disabled}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : uploadingLogo ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Shop
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}