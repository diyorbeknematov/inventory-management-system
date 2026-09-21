import { useEffect, useState } from "react";
import {
  Search,
  Users as UsersIcon,
  UserRound,
  Store,
  Warehouse,
  Shield,
  Plus,
  Building2,
  Lock,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";

import { getUsers, deleteUser } from "../api/users";
import type { User } from "../types/users";
import CreateUserModal from "../components/users/CreateUserModal";

type CurrentUser = {
  role_name: string;
  merchants_id: string | null;
  merchant_name?: string | null;
};

function getCurrentUser(): CurrentUser | null {
  try {
    const saved = localStorage.getItem("user");
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    return {
      role_name: parsed.role_name,
      merchants_id: parsed.merchants_id ?? null,
      merchant_name: parsed.merchant_name ?? null,
    };
  } catch (err) {
    console.error("Failed to read current user:", err);
    return null;
  }
}

const getRoleStyle = (roleName: string) => {
  switch (roleName) {
    case "Admin":
      return "bg-purple-50 text-purple-700";
    case "Merchant":
      return "bg-blue-50 text-blue-700";
    case "Shop Manager":
      return "bg-emerald-50 text-emerald-700";
    case "Warehouse Manager":
      return "bg-orange-50 text-orange-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const getScopeName = (user: User) => {
  if (user.scope_type?.includes("SHOP")) {
    return user.shop_name || "Shop not found";
  }

  if (user.scope_type?.includes("WAREHOUSE")) {
    return user.warehouse_name || "Warehouse not found";
  }

  return "—";
};

function Users() {
  const [currentUser] = useState<CurrentUser | null>(getCurrentUser);

  const isAdmin = currentUser?.role_name === "Admin";
  const isMerchant = currentUser?.role_name === "Merchant";
  const canManageUsers = isAdmin || isMerchant;

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState<{ message: string } | null>(null);

  /* -------------------------------------------------------------------------- */
  /* Success Toast                                                              */
  /* -------------------------------------------------------------------------- */

  function showSuccessToast(message: string) {
    setToast({ message });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  /* -------------------------------------------------------------------------- */
  /* Load users                                                                 */
  /* -------------------------------------------------------------------------- */

  const loadUsers = async (searchValue = "") => {
    try {
      setLoading(true);
      setError("");

      const response = await getUsers(searchValue);
      setUsers(response.data.data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load users"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers) return;

    loadUsers();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return;

    const timer = setTimeout(() => loadUsers(search), 300);

    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, canManageUsers]);

  /* -------------------------------------------------------------------------- */
  /* Delete                                                                     */
  /* -------------------------------------------------------------------------- */

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;

    setUserToDelete(null);
    setDeleteError("");
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      setDeleteLoading(true);
      setDeleteError("");

      await deleteUser({
        user_id: userToDelete.guid,
      });

      await loadUsers(search);

      setUserToDelete(null);
      setDeleteError("");

      showSuccessToast("User deleted successfully");
    } catch (err) {
      console.error("Failed to delete user:", err);

      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete user"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Create                                                                     */
  /* -------------------------------------------------------------------------- */

  const handleUserCreated = async () => {
    await loadUsers(search);

    setShowCreateModal(false);

    showSuccessToast("User created successfully");
  };

  /* -------------------------------------------------------------------------- */
  /* Access restricted                                                          */
  /* -------------------------------------------------------------------------- */

  if (!canManageUsers) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Lock size={20} className="text-slate-400" />
        </div>

        <h3 className="text-sm font-semibold text-slate-700">
          Access restricted
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Success Toast */}
      {toast && (
        <div className="fixed right-5 top-5 z-[300] flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <CheckCircle2
            size={18}
            className="text-green-600"
          />

          <p className="text-sm font-medium text-slate-800">
            {toast.message}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersIcon size={22} />

            <h1 className="text-xl font-semibold text-slate-800">
              Users
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Manage users and their roles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-500">
              Total:{" "}
            </span>

            <span className="text-sm font-semibold text-slate-800">
              {users.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus size={17} />
            Create User
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
          />
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-slate-500">
            Loading users...
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <UsersIcon size={22} className="text-slate-400" />
          </div>

          <h3 className="text-sm font-semibold text-slate-700">
            No users found
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Try changing your search.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    User
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Merchant
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assigned to
                  </th>

                  <th className="w-[100px] px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => {
                  const isCurrentUser =
                    currentUser &&
                    user.guid ===
                      (() => {
                        try {
                          const saved =
                            localStorage.getItem("user");

                          if (!saved) return null;

                          return JSON.parse(saved)?.guid;
                        } catch {
                          return null;
                        }
                      })();

                  return (
                    <tr
                      key={user.guid}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <UserRound
                              size={17}
                              className="text-slate-500"
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {user.full_name || "—"}
                            </p>

                            <p className="truncate text-xs text-slate-400">
                              @{user.login || "unknown"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building2
                            size={16}
                            className="text-slate-400"
                          />

                          <span className="text-sm text-slate-700">
                            {user.merchant_name || "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getRoleStyle(
                            user.role_name
                          )}`}
                        >
                          <Shield size={13} />
                          {user.role_name || "Unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {user.scope_type?.includes("SHOP") &&
                        user.shop_name ? (
                          <div className="flex items-center gap-2">
                            <Store
                              size={17}
                              className="text-slate-400"
                            />

                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                {user.shop_name}
                              </p>

                              <p className="text-xs text-slate-400">
                                Shop
                              </p>
                            </div>
                          </div>
                        ) : user.scope_type?.includes("WAREHOUSE") &&
                          user.warehouse_name ? (
                          <div className="flex items-center gap-2">
                            <Warehouse
                              size={17}
                              className="text-slate-400"
                            />

                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                {user.warehouse_name}
                              </p>

                              <p className="text-xs text-slate-400">
                                Warehouse
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            {getScopeName(user)}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {!isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => openDeleteModal(user)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && currentUser && (
        <CreateUserModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleUserCreated}
        />
      )}

      {/* Delete confirmation modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">
                Delete user
              </h2>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
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

              <h3 className="text-sm font-semibold text-slate-800">
                Are you sure you want to delete this user?
              </h3>

              <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-800">
                  {userToDelete.full_name || "—"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  @{userToDelete.login || "unknown"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Role:{" "}
                  <span className="font-medium text-slate-700">
                    {userToDelete.role_name}
                  </span>
                </p>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                This action cannot be undone.
              </p>

              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-700">
                    {deleteError}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} />

                {deleteLoading
                  ? "Deleting..."
                  : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
