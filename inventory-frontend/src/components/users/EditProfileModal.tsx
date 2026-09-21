import { useState } from "react";
import {
  X,
  UserRound,
  UserCog,
  Mail,
  LockKeyhole,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

import { updateProfile } from "../../api/users";
import type { UpdateProfileRequest } from "../../types/users";

type CurrentUser = {
  user_id: string;
  full_name: string;
  login: string;
  email: string;
};

type Props = {
  currentUser: CurrentUser;
  onClose: () => void;
  onUpdated: (updated: CurrentUser) => void;
};

function EditProfileModal({ currentUser, onClose, onUpdated }: Props) {
  // currentUser.full_name/login/email localStorage'dan kelayotgani uchun
  // ba'zida null/undefined bo'lib chiqishi mumkin — shuning uchun
  // form'ni to'ldirishda har biriga bo'sh matn fallback beramiz.
  const [form, setForm] = useState({
    full_name: currentUser.full_name ?? "",
    login: currentUser.login ?? "",
    email: currentUser.email ?? "",
    password: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ?. bilan yana bir bor himoyalanamiz — form ichidagi qiymatlar
  // qayerdandir null bo'lib qolsa ham, .trim() chaqirilganda qulamaydi.
  const canSubmit = form.full_name?.trim() && form.login?.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    try {
      setSubmitting(true);
      setError("");

      const payload: UpdateProfileRequest = {
        user_id: currentUser.user_id,
        full_name: form.full_name.trim(),
        login: form.login.trim(),
        email: form.email.trim(),
      };

      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      await updateProfile(payload);

      const updated: CurrentUser = {
        user_id: currentUser.user_id,
        full_name: payload.full_name ?? currentUser.full_name,
        login: payload.login ?? currentUser.login,
        email: payload.email ?? currentUser.email,
      };

      const saved = JSON.parse(localStorage.getItem("user") || "{}");

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...saved,
          ...updated,
        })
      );

      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error("Failed to update profile:", err);

      setError(
        err instanceof Error ? err.message : "Profilni yangilab bo'lmadi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <UserCog size={18} className="text-slate-600" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Edit Profile
              </h2>

              <p className="text-xs text-slate-500">
                Update your own account details
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

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <UserRound size={15} className="text-slate-400" />
              Full name
            </label>

            <input
              type="text"
              value={form.full_name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  full_name: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <UserCog size={15} className="text-slate-400" />
              Login
            </label>

            <input
              type="text"
              value={form.login}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  login: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail size={15} className="text-slate-400" />
              Email
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <LockKeyhole size={15} className="text-slate-400" />
              New password
              <span className="font-normal text-slate-400">(optional)</span>
            </label>

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
                placeholder="Leave empty to keep current password"
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
          </div>
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
            <Save size={16} />
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditProfileModal;