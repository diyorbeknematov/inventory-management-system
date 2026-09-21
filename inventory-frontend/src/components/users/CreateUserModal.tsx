import { useEffect, useState } from "react";
import {
  X,
  UserCog,
  LockKeyhole,
  Shield,
  Building2,
  Store,
  Warehouse,
  ChevronDown,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  getMerchantsForSelect,
  getRolesForSelect,
  getShopsForSelect,
  getWarehousesForSelect,
} from "../../api/select_data";

import { createUser } from "../../api/users";

type CurrentUser = {
  role_name: string;
  merchants_id: string | null;
  merchant_name?: string | null;
};

type Option = {
  guid: string;
  name: string;
};

type Props = {
  currentUser: CurrentUser;
  onClose: () => void;
  onCreated: () => void;
};

function CreateUserModal({ currentUser, onClose, onCreated }: Props) {
  const isAdmin = currentUser.role_name === "Admin";

  const [form, setForm] = useState({
    login: "",
    password: "",
    role_id: "",
    merchant_id: isAdmin ? "" : currentUser.merchants_id ?? "",
    scope_id: "",
  });

  const [roles, setRoles] = useState<Option[]>([]);
  const [merchants, setMerchants] = useState<Option[]>([]);
  const [shops, setShops] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);

  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [loadingScope, setLoadingScope] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Parolni ko'rsatish/yashirish uchun
  const [showPassword, setShowPassword] = useState(false);

  // -----------------------------------------
  // Load roles
  // -----------------------------------------

  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoadingRoles(true);
        setError("");

        const response = await getRolesForSelect();

        setRoles(response.data.data.roles);
      } catch (err) {
        console.error("Failed to load roles:", err);

        setError("Failed to load roles");
      } finally {
        setLoadingRoles(false);
      }
    };

    loadRoles();
  }, []);

  // -----------------------------------------
  // Available roles
  //
  // Admin -> hamma rolьni yarata oladi (Merchant, Shop Manager,
  //          Warehouse Manager va kelajakda qo'shiladigan boshqa
  //          har qanday rolь).
  // Merchant -> faqat o'ziga tegishli managerlarni yarata oladi:
  //          "Merchant" va "Admin" rollarini bermaymiz.
  // -----------------------------------------

  const availableRoles = isAdmin
    ? roles
    : roles.filter(
        (role) => role.name !== "Merchant" && role.name !== "Admin"
      );

  const selectedRole = roles.find((role) => role.guid === form.role_id);

  const roleName = selectedRole?.name ?? "";

  const isMerchant = roleName === "Merchant";
  const isShopManager = roleName === "Shop Manager";
  const isWarehouseManager = roleName === "Warehouse Manager";

  /*
   * Merchant tanlash kerak bo'ladigan holatlar:
   *
   * 1. Admin -> Merchant
   * 2. Admin -> Shop Manager
   * 3. Admin -> Warehouse Manager
   *
   * Chunki Adminning o'z merchant'i yo'q.
   *
   * Oddiy Merchant uchun merchant avtomatik.
   */
  const needsMerchant =
    isAdmin && (isMerchant || isShopManager || isWarehouseManager);

  // -----------------------------------------
  // Load merchants
  // -----------------------------------------

  useEffect(() => {
    if (!needsMerchant) {
      setMerchants([]);
      return;
    }

    const loadMerchants = async () => {
      try {
        setLoadingMerchants(true);

        const response = await getMerchantsForSelect();

        setMerchants(response.data.data.merchants);
      } catch (err) {
        console.error("Failed to load merchants:", err);

        setError("Failed to load merchants");
      } finally {
        setLoadingMerchants(false);
      }
    };

    loadMerchants();
  }, [needsMerchant]);

  // -----------------------------------------
  // Role change
  // -----------------------------------------

  const handleRoleChange = (roleId: string) => {
    const role = roles.find((item) => item.guid === roleId);

    const newRoleName = role?.name ?? "";

    const newIsMerchant = newRoleName === "Merchant";
    const newIsShopManager = newRoleName === "Shop Manager";
    const newIsWarehouseManager = newRoleName === "Warehouse Manager";

    const newNeedsMerchant =
      isAdmin &&
      (newIsMerchant || newIsShopManager || newIsWarehouseManager);

    setForm((prev) => ({
      ...prev,
      role_id: roleId,
      scope_id: "",

      merchant_id:
        isAdmin && newNeedsMerchant
          ? prev.merchant_id
          : isAdmin
            ? ""
            : prev.merchant_id,
    }));

    setShops([]);
    setWarehouses([]);
    setError("");
  };

  // -----------------------------------------
  // Load shops / warehouses
  // -----------------------------------------

  useEffect(() => {
    setShops([]);
    setWarehouses([]);

    if (!isShopManager && !isWarehouseManager) {
      return;
    }

    /*
     * Admin:
     * merchant_id select orqali tanlanadi.
     *
     * Merchant:
     * merchant_id avtomatik o'z merchant'iga teng.
     */
    if (!form.merchant_id) {
      return;
    }

    const loadScope = async () => {
      try {
        setLoadingScope(true);

        if (isShopManager) {
          const response = await getShopsForSelect(form.merchant_id);

          setShops(response.data.data.shops);
        }

        if (isWarehouseManager) {
          const response = await getWarehousesForSelect(form.merchant_id);

          setWarehouses(response.data.data.warehouses);
        }
      } catch (err) {
        console.error("Failed to load scope:", err);

        setError(
          isShopManager ? "Failed to load shops" : "Failed to load warehouses"
        );
      } finally {
        setLoadingScope(false);
      }
    };

    loadScope();
  }, [form.merchant_id, isShopManager, isWarehouseManager]);

  // -----------------------------------------
  // Validation
  // -----------------------------------------

  const canSubmit =
    form.login.trim() !== "" &&
    form.password.trim() !== "" &&
    form.role_id !== "" &&
    (!needsMerchant || form.merchant_id !== "") &&
    (!isShopManager || form.scope_id !== "") &&
    (!isWarehouseManager || form.scope_id !== "");

  // -----------------------------------------
  // Submit
  // -----------------------------------------

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await createUser({
        username: form.login.trim(),
        password: form.password,
        role_id: form.role_id,
        merchants_id: form.merchant_id,
        scope_id: form.scope_id || undefined,
        scope_type: isShopManager
          ? "SHOP"
          : isWarehouseManager
            ? "WAREHOUSE"
            : undefined,
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create user:", err);

      setError(
        err instanceof Error ? err.message : "Foydalanuvchini yaratib bo'lmadi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <UserCog size={19} className="text-slate-600" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Create User
              </h2>

              <p className="text-xs text-slate-500">
                Set up login credentials and access permissions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Login */}
          <Field label="Login" icon={<UserCog size={15} />}>
            <input
              type="text"
              value={form.login}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, login: e.target.value }))
              }
              placeholder="Enter login"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </Field>

          {/* Password */}
          <Field label="Password" icon={<LockKeyhole size={15} />}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="Enter password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-slate-400"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          {/* Role */}
          <Field label="Role" icon={<Shield size={15} />}>
            <Select
              value={form.role_id}
              onChange={handleRoleChange}
              placeholder={loadingRoles ? "Loading roles..." : "Select role"}
              disabled={loadingRoles}
              options={availableRoles.map((role) => ({
                value: role.guid,
                label: role.name,
              }))}
            />
          </Field>

          {/* Merchant */}
          {needsMerchant && (
            <Field label="Merchant" icon={<Building2 size={15} />}>
              <Select
                value={form.merchant_id}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    merchant_id: value,
                    scope_id: "",
                  }))
                }
                placeholder={
                  loadingMerchants ? "Loading merchants..." : "Select merchant"
                }
                disabled={loadingMerchants}
                options={merchants.map((merchant) => ({
                  value: merchant.guid,
                  label: merchant.name,
                }))}
              />
            </Field>
          )}

          {/* Current Merchant */}
          {!isAdmin && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              <Building2 size={16} className="shrink-0 text-slate-400" />

              <span>{currentUser.merchant_name ?? "Your merchant"}</span>
            </div>
          )}

          {/* Shop */}
          {isShopManager && (
            <Field label="Assign to shop" icon={<Store size={15} />}>
              <Select
                value={form.scope_id}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, scope_id: value }))
                }
                placeholder={
                  !form.merchant_id
                    ? "Select merchant first"
                    : loadingScope
                      ? "Loading shops..."
                      : "Select shop"
                }
                disabled={!form.merchant_id || loadingScope}
                options={shops.map((shop) => ({
                  value: shop.guid,
                  label: shop.name,
                }))}
              />
            </Field>
          )}

          {/* Warehouse */}
          {isWarehouseManager && (
            <Field label="Assign to warehouse" icon={<Warehouse size={15} />}>
              <Select
                value={form.scope_id}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, scope_id: value }))
                }
                placeholder={
                  !form.merchant_id
                    ? "Select merchant first"
                    : loadingScope
                      ? "Loading warehouses..."
                      : "Select warehouse"
                }
                disabled={!form.merchant_id || loadingScope}
                options={warehouses.map((warehouse) => ({
                  value: warehouse.guid,
                  label: warehouse.name,
                }))}
              />
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />

            {submitting ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// Field
// =========================================

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className="text-slate-400">{icon}</span>

        {label}
      </label>

      {children}
    </div>
  );
}

// =========================================
// Custom Select
// =========================================

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none transition hover:border-slate-300 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        <span
          className={
            selectedOption ? "truncate text-slate-700" : "text-slate-400"
          }
        >
          {selectedOption?.label ?? placeholder}
        </span>

        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-slate-400">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                  option.value === value
                    ? "bg-slate-50 font-medium text-slate-800"
                    : "text-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CreateUserModal;