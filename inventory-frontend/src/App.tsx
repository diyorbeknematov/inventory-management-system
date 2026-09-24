import { useEffect, useRef, useState } from "react";
import {
  Package,
  Warehouse,
  Store,
  Tags,
  ArrowLeftRight,
  ChevronDown,
  Menu,
  Boxes,
  LogOut,
  Building2,
  Users as UsersIcon,
  Pencil,
  CheckCircle2,
} from "lucide-react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Warehouses from "./pages/Warehouses";
import Shops from "./pages/Shops";
import Movements from "./pages/Movements";
import Users from "./pages/Users";
import Merchants from "./pages/Merchants";
import Login from "./pages/Login";
import EditProfileModal from "./components/users/EditProfileModal";

import { getMerchants } from "./api/merchants";
import type { Merchant } from "./types/merchant";

type User = {
  user_id: string;
  merchants_id: string | null;
  full_name: string;
  login: string;
  email: string;
  role_id: string;
  role_name: string;
  shop_id: string;
  warehouse_id: string;
};

function getStoredUser(): User | null {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] =
    useState(
      Boolean(
        localStorage.getItem("access_token")
      )
    );

  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    setIsAuthenticated(false);

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate
              to="/products"
              replace
            />
          ) : (
            <Login
              onLogin={() => {
                setIsAuthenticated(true);

                const user =
                  getStoredUser();

                if (
                  user?.role_name ===
                  "Shop Manager"
                ) {
                  navigate("/shops", {
                    replace: true,
                  });
                } else {
                  navigate("/products", {
                    replace: true,
                  });
                }
              }}
            />
          )
        }
      />

      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Dashboard
              onLogout={handleLogout}
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />
    </Routes>
  );
}

type DashboardProps = {
  onLogout: () => void;
};

function Dashboard({
  onLogout,
}: DashboardProps) {
  const [user, setUser] =
    useState<User | null>(
      getStoredUser
    );

  const [merchants, setMerchants] =
    useState<Merchant[]>([]);

  /*
   * Admin:
   *
   * "" -> All merchants
   * "merchant-guid" -> selected merchant
   *
   * Other roles:
   * user.merchants_id avtomatik ishlatiladi.
   */
  const [
    selectedMerchantId,
    setSelectedMerchantId,
  ] = useState("");

  const [
    loadingMerchants,
    setLoadingMerchants,
  ] = useState(false);

  const [
    isProfileOpen,
    setIsProfileOpen,
  ] = useState(false);

  const [
    isMerchantOpen,
    setIsMerchantOpen,
  ] = useState(false);

  const [
    showEditProfile,
    setShowEditProfile,
  ] = useState(false);

  const [
    successToast,
    setSuccessToast,
  ] = useState("");

  const profileRef =
    useRef<HTMLDivElement>(null);

  const merchantRef =
    useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin =
    user?.role_name === "Admin";

  const isShopManager =
    user?.role_name ===
    "Shop Manager";

  const showSuccessToast = (
    message: string
  ) => {
    setSuccessToast(message);

    setTimeout(() => {
      setSuccessToast("");
    }, 3000);
  };

  /* ---------------------------------------------------------------------- */
  /* Load merchants                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    
    const loadMerchants = async () => {
      try {
        setLoadingMerchants(true);

        const response =
          await getMerchants();

        const merchantList =
          response.data.data.merchants;

        setMerchants(
          merchantList ?? []
        );
      } catch (error) {
        console.error(
          "Failed to load merchants:",
          error
        );
      } finally {
        setLoadingMerchants(false);
      }
    };

    loadMerchants();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Non-admin merchant                                                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (
      !isAdmin &&
      user?.merchants_id
    ) {
      setSelectedMerchantId(
        user.merchants_id
      );
    }
  }, [
    isAdmin,
    user?.merchants_id,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Admin merchant validation                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    if (!selectedMerchantId) {
      return;
    }

    const selectedStillExists =
      merchants.some(
        (merchant) =>
          merchant.guid ===
          selectedMerchantId
      );

    if (!selectedStillExists) {
      setSelectedMerchantId("");
    }
  }, [
    isAdmin,
    merchants,
    selectedMerchantId,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Click outside                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target as Node
        )
      ) {
        setIsProfileOpen(false);
      }

      if (
        merchantRef.current &&
        !merchantRef.current.contains(
          event.target as Node
        )
      ) {
        setIsMerchantOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const selectedMerchant =
    merchants.find(
      (merchant) =>
        merchant.guid ===
        selectedMerchantId
    );

  const isActive = (
    path: string
  ) =>
    location.pathname === path;

  const initials = (
    user?.full_name || "U"
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase()
    )
    .join("");

  if (loadingMerchants) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-500">
          Loading merchants...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                            */}
      {/* ------------------------------------------------------------------ */}

      <aside className="w-60 border-r border-slate-200 bg-white p-5">
        {/* Logo */}

        <div className="mb-6 flex items-center gap-2">
          <Boxes size={25} />

          <div>
            <h1 className="font-semibold">
              Inventory
            </h1>

            <p className="text-xs text-slate-500">
              Management
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Merchant selector - faqat Admin                                 */}
        {/* ---------------------------------------------------------------- */}

        {isAdmin && (
          <div className="mb-6">
            <div
              className="relative"
              ref={merchantRef}
            >
              <button
                type="button"
                onClick={() => {
                  if (
                    merchants.length > 0
                  ) {
                    setIsMerchantOpen(
                      (open) => !open
                    );
                  }
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-left ${
                  merchants.length > 0
                    ? "cursor-pointer hover:bg-slate-100"
                    : "cursor-default"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Merchant
                  </p>

                  <p
                    className={`truncate text-sm ${
                      selectedMerchant
                        ? "font-medium text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {selectedMerchant?.name ||
                      "All merchants"}
                  </p>
                </div>

                {merchants.length > 0 && (
                  <Menu
                    size={16}
                    className="shrink-0 text-slate-400"
                  />
                )}
              </button>

              {isMerchantOpen &&
                merchants.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {/* All merchants */}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMerchantId(
                          ""
                        );

                        setIsMerchantOpen(
                          false
                        );
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                        selectedMerchantId ===
                        ""
                          ? "bg-slate-100 font-medium text-slate-800"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      All merchants
                    </button>

                    {/* Merchants */}

                    {merchants.map(
                      (merchant) => (
                        <button
                          key={
                            merchant.guid
                          }
                          type="button"
                          onClick={() => {
                            setSelectedMerchantId(
                              merchant.guid
                            );

                            setIsMerchantOpen(
                              false
                            );
                          }}
                          className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                            merchant.guid ===
                            selectedMerchantId
                              ? "bg-slate-100 font-medium text-slate-800"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {merchant.name}
                        </button>
                      )
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Navigation                                                       */}
        {/* ---------------------------------------------------------------- */}

        {!isShopManager && (
          <nav className="space-y-1">
            <SidebarItem
              icon={
                <Package size={18} />
              }
              text="Products"
              active={isActive(
                "/products"
              )}
              onClick={() =>
                navigate(
                  "/products"
                )
              }
            />

            <SidebarItem
              icon={
                <Tags size={18} />
              }
              text="Categories"
              active={isActive(
                "/categories"
              )}
              onClick={() =>
                navigate(
                  "/categories"
                )
              }
            />

            <SidebarItem
              icon={
                <Warehouse size={18} />
              }
              text="Warehouse"
              active={isActive(
                "/warehouse"
              )}
              onClick={() =>
                navigate(
                  "/warehouse"
                )
              }
            />

            <SidebarItem
              icon={
                <Store size={18} />
              }
              text="Shops"
              active={isActive(
                "/shops"
              )}
              onClick={() =>
                navigate("/shops")
              }
            />
          </nav>
        )}

        {isShopManager && (
          <nav className="space-y-1">
            <SidebarItem
              icon={
                <Store size={18} />
              }
              text="My Shop"
              active={isActive(
                "/shops"
              )}
              onClick={() =>
                navigate("/shops")
              }
            />
          </nav>
        )}

        <nav className="mt-1 space-y-1">
          <SidebarItem
            icon={
              <ArrowLeftRight size={18} />
            }
            text="Movements"
            active={isActive(
              "/movements"
            )}
            onClick={() =>
              navigate("/movements")
            }
          />

          {!isShopManager && (
            <SidebarItem
              icon={
                <UsersIcon size={18} />
              }
              text="Users"
              active={isActive(
                "/users"
              )}
              onClick={() =>
                navigate("/users")
              }
            />
          )}

          {isAdmin && (
            <SidebarItem
              icon={
                <Building2 size={18} />
              }
              text="Merchants"
              active={isActive(
                "/merchants"
              )}
              onClick={() =>
                navigate(
                  "/merchants"
                )
              }
            />
          )}
        </nav>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main                                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex-1">
        {/* Header */}

        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h2 className="font-semibold">
              {isShopManager
                ? "My Shop"
                : selectedMerchant?.name ||
                  "All merchants"}
            </h2>

            <p className="text-xs text-slate-500">
              Inventory Management
            </p>
          </div>

          {/* User menu */}

          <div
            className="relative"
            ref={profileRef}
          >
            <button
              type="button"
              onClick={() =>
                setIsProfileOpen(
                  (open) => !open
                )
              }
              className="flex items-center gap-2.5 text-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">
                {initials}
              </span>

              <span className="text-slate-700">
                {user?.full_name ||
                  "User"}
              </span>

              <ChevronDown
                size={16}
                className="text-slate-400"
              />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-60 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
                    {initials}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {user?.full_name ||
                        "User"}
                    </p>

                    <p className="truncate text-xs text-slate-500">
                      @
                      {user?.login ||
                        "unknown"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(
                      false
                    );

                    setShowEditProfile(
                      true
                    );
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Pencil size={15} />
                  Edit profile
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Pages                                                              */}
        {/* ------------------------------------------------------------------ */}

        <main className="p-8">
          <Routes>
            {/* Users */}

            <Route
              path="/users"
              element={
                isShopManager ? (
                  <Navigate
                    to="/shops"
                    replace
                  />
                ) : (
                  <Users />
                )
              }
            />

            {/* Merchants */}

            <Route
              path="/merchants"
              element={
                isAdmin ? (
                  <Merchants
                    onMerchantsChange={(
                      updatedMerchants
                    ) => {
                      setMerchants(
                        updatedMerchants
                      );
                    }}
                  />
                ) : (
                  <Navigate
                    to={
                      isShopManager
                        ? "/shops"
                        : "/products"
                    }
                    replace
                  />
                )
              }
            />

            {/* Products */}

            <Route
              path="/products"
              element={
                isShopManager ? (
                  <Navigate
                    to="/shops"
                    replace
                  />
                ) : (
                  <Products
                    merchantId={
                      selectedMerchantId ||
                      undefined
                    }
                  />
                )
              }
            />

            {/* Categories */}

            <Route
              path="/categories"
              element={
                isShopManager ? (
                  <Navigate
                    to="/shops"
                    replace
                  />
                ) : (
                  <Categories
                    merchantId={
                      selectedMerchantId ||
                      undefined
                    }
                  />
                )
              }
            />

            {/* Warehouse */}

            <Route
              path="/warehouse"
              element={
                isShopManager ? (
                  <Navigate
                    to="/shops"
                    replace
                  />
                ) : (
                  <Warehouses
                    merchantId={
                      selectedMerchantId ||
                      undefined
                    }
                  />
                )
              }
            />

            {/* Shops */}

            <Route
              path="/shops"
              element={
                <Shops
                  merchantId={
                    selectedMerchantId ||
                    undefined
                  }
                  shopId={
                    isShopManager
                      ? user?.shop_id
                      : undefined
                  }
                />
              }
            />

            {/* Movements */}

            <Route
              path="/movements"
              element={
                <Movements
                  merchants={merchants}
                  merchantId={
                    selectedMerchantId ||
                    undefined
                  }
                  shopId={
                    isShopManager
                      ? user?.shop_id
                      : undefined
                  }
                />
              }
            />

            {/* Unknown route */}

            <Route
              path="*"
              element={
                <Navigate
                  to={
                    isShopManager
                      ? "/shops"
                      : "/products"
                  }
                  replace
                />
              }
            />
          </Routes>
        </main>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Edit profile                                                       */}
      {/* ------------------------------------------------------------------ */}

      {showEditProfile &&
        user && (
          <EditProfileModal
            currentUser={{
              user_id:
                user.user_id,
              full_name:
                user.full_name,
              login:
                user.login,
              email:
                user.email,
            }}
            onClose={() =>
              setShowEditProfile(
                false
              )
            }
            onUpdated={(updated) => {
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      ...updated,
                    }
                  : prev
              );

              showSuccessToast(
                "Profile updated successfully"
              );
            }}
          />
        )}

      {/* ------------------------------------------------------------------ */}
      {/* Success toast                                                       */}
      {/* ------------------------------------------------------------------ */}

      {successToast && (
        <div className="fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700 shadow-lg">
          <CheckCircle2
            size={18}
            className="text-emerald-500"
          />

          {successToast}
        </div>
      )}
    </div>
  );
}

type SidebarItemProps = {
  icon: React.ReactNode;
  text: string;
  active: boolean;
  onClick: () => void;
};

function SidebarItem({
  icon,
  text,
  active,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
        active
          ? "bg-slate-100 font-medium"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {icon}

      {text}
    </button>
  );
}

export default App;