import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, AlertTriangle } from "lucide-react";

import {
  createStockMovement,
  updateStockMovement,
} from "../../api/movements";

import { getShopStocks } from "../../api/shops";
import { getWarehouseStocks } from "../../api/warehouses";
import { getProductsForSelect } from "../../api/select_data";

import type {
  MovementType,
  FrontendMovement,
  CreateStockMovementItem,
  CreateStockMovementRequest,
  UpdateStockMovementRequest,
} from "../../types/movement";

import type { Shop } from "../../types/shop";
import type { Warehouse } from "../../types/warehouse";
import type { ProductSelect } from "../../types/select_data";

type Props = {
  shops: Shop[];
  warehouses: Warehouse[];
  merchants: MerchantOption[];

  merchantId?: string;
  shopId?: string;

  movement?: FrontendMovement;

  onClose: () => void;
  onCreated: () => Promise<void>;
};

type LocationType = "SHOP" | "WAREHOUSE";

type SourceStock = {
  product_id: string;
  product_name: string;
  variation_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
};

type MerchantOption = {
  guid: string;
  name: string;
};

type SelectedItem = {
  variationId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
};

type NormalizedVariation = {
  guid: string;
  sku: string;
  size: string;
  color: string;
};

type SourceProduct = {
  guid: string;
  name: string;
  variations: {
    variation_id: string;
    sku: string;
    size: string;
    color: string;
  }[];
};

type PendingSourceChange =
  | { kind: "location"; locationId: string }
  | { kind: "type"; newSourceType: LocationType }
  | { kind: "merchant"; newMerchantId: string };

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function extractStocks(response: unknown): SourceStock[] {
  const arrays: unknown[][] = [];

  function walk(value: unknown) {
    if (Array.isArray(value)) {
      arrays.push(value);
      for (const item of value) walk(item);
      return;
    }

    if (!value || typeof value !== "object") return;

    const object = value as Record<string, unknown>;
    for (const item of Object.values(object)) walk(item);
  }

  walk(response);

  for (const array of arrays) {
    const stocks: SourceStock[] = [];

    for (const item of array) {
      if (!item || typeof item !== "object") continue;

      const stock = item as Record<string, unknown>;

      if (
        typeof stock.product_id !== "string" ||
        typeof stock.variation_id !== "string"
      ) {
        continue;
      }

      stocks.push({
        product_id: stock.product_id,
        product_name:
          typeof stock.product_name === "string" ? stock.product_name : "",
        variation_id: stock.variation_id,
        sku: typeof stock.sku === "string" ? stock.sku : "",
        size: typeof stock.size === "string" ? stock.size : null,
        color: typeof stock.color === "string" ? stock.color : null,
        quantity:
          typeof stock.quantity === "number"
            ? stock.quantity
            : Number(stock.quantity ?? 0),
      });
    }

    if (stocks.length > 0) return stocks;
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AddMovementModal({
  shops,
  warehouses,
  merchants,
  merchantId,
  shopId,
  movement,
  onClose,
  onCreated,
}: Props) {
  const isShopManager = Boolean(shopId);
  const isEditMode = Boolean(movement);

  /* ------------------------------------------------------------------------ */
  /* Merchant                                                                 */
  /* ------------------------------------------------------------------------ */

  const [selectedMerchantId, setSelectedMerchantId] = useState(
    movement?.merchantId ?? merchantId ?? ""
  );

  /* ------------------------------------------------------------------------ */
  /* Initial values                                                           */
  /* ------------------------------------------------------------------------ */

  const initialSourceType: LocationType =
    movement?.from.type === "WAREHOUSE" ? "WAREHOUSE" : "SHOP";

  const initialDestinationType: LocationType =
    movement?.to.type === "WAREHOUSE" ? "WAREHOUSE" : "SHOP";

  const initialSourceId =
    movement &&
    (movement.from.type === "SHOP" || movement.from.type === "WAREHOUSE")
      ? movement.from.id
      : shopId ?? "";

  const initialDestinationId =
    movement &&
    (movement.to.type === "SHOP" || movement.to.type === "WAREHOUSE")
      ? movement.to.id
      : "";

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  const [type, setType] = useState<MovementType>(
    movement?.type ?? "TRANSFER"
  );

  const [sourceType, setSourceType] = useState<LocationType>(
    isEditMode ? initialSourceType : "SHOP"
  );

  const [destinationType, setDestinationType] = useState<LocationType>(
    isEditMode
      ? initialDestinationType
      : isShopManager
        ? "SHOP"
        : "WAREHOUSE"
  );

  const [sourceId, setSourceId] = useState(initialSourceId);
  const [destinationId, setDestinationId] = useState(initialDestinationId);

  const [sourceStocks, setSourceStocks] = useState<SourceStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Pending change (tasdiqlash kutilayotgan o'zgarish)                       */
  /* ------------------------------------------------------------------------ */

  const [pendingSourceChange, setPendingSourceChange] =
    useState<PendingSourceChange | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Source changed? (backend bilan bir xil mantiq — faqat SOURCE tekshiriladi) */
  /* ------------------------------------------------------------------------ */

  const originalMerchantId = movement?.merchantId ?? "";

  const originalSourceShopId =
    movement?.from.type === "SHOP" ? movement.from.id : "";

  const originalSourceWarehouseId =
    movement?.from.type === "WAREHOUSE" ? movement.from.id : "";

  const currentSourceShopId = sourceType === "SHOP" ? sourceId : "";
  const currentSourceWarehouseId =
    sourceType === "WAREHOUSE" ? sourceId : "";

  const sourceChanged =
    isEditMode &&
    (originalMerchantId !== selectedMerchantId ||
      originalSourceShopId !== currentSourceShopId ||
      originalSourceWarehouseId !== currentSourceWarehouseId);

  /*
   * Edit rejimida, agar source (yoki merchant) o'zgargan bo'lsa — backend
   * eski itemlarni o'chirib, yangilarini shu so'rovdagi `items`dan yaratadi.
   * Shuning uchun bu holatda ham "yangi yaratish"dagi kabi product tanlash
   * UI ko'rsatiladi.
   */
  const showProductsSection = !isEditMode || sourceChanged;

  /* ------------------------------------------------------------------------ */
  /* Receipt products                                                         */
  /* ------------------------------------------------------------------------ */

  const [receiptProducts, setReceiptProducts] = useState<ProductSelect[]>([]);
  const [receiptProductsLoading, setReceiptProductsLoading] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");

  const [items, setItems] = useState<SelectedItem[]>([]);
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ------------------------------------------------------------------------ */
  /* Merchant-specific locations                                             */
  /* ------------------------------------------------------------------------ */

  const merchantShops = useMemo(() => {
    if (!selectedMerchantId) return [];
    return shops.filter((shop) => shop.merchants_id === selectedMerchantId);
  }, [shops, selectedMerchantId]);

  const merchantWarehouses = useMemo(() => {
    if (!selectedMerchantId) return [];
    return warehouses.filter(
      (warehouse) => warehouse.merchants_id === selectedMerchantId
    );
  }, [warehouses, selectedMerchantId]);

  const availableShops = useMemo(() => {
    if (!isShopManager) return merchantShops;
    return merchantShops.filter((shop) => shop.guid !== shopId);
  }, [merchantShops, shopId, isShopManager]);

  const sourceOptions =
    sourceType === "SHOP" ? merchantShops : merchantWarehouses;

  const destinationOptions =
    destinationType === "SHOP" ? availableShops : merchantWarehouses;

  /* ------------------------------------------------------------------------ */
  /* Load receipt products                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (type !== "RECEIPT" || !selectedMerchantId || !showProductsSection) {
      setReceiptProducts([]);
      setReceiptProductsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadReceiptProducts() {
      setReceiptProductsLoading(true);
      setReceiptProducts([]);

      try {
        const response = await getProductsForSelect(selectedMerchantId);
        if (cancelled) return;

        setReceiptProducts(response.data.data.products ?? []);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load receipt products:", error);
          setReceiptProducts([]);
          setError(
            error instanceof Error ? error.message : "Failed to load products."
          );
        }
      } finally {
        if (!cancelled) setReceiptProductsLoading(false);
      }
    }

    loadReceiptProducts();

    return () => {
      cancelled = true;
    };
  }, [selectedMerchantId, type, showProductsSection]);

  /* ------------------------------------------------------------------------ */
  /* Load source stocks                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (type === "RECEIPT" || !sourceId || !showProductsSection) {
      setSourceStocks([]);
      return;
    }

    let cancelled = false;

    async function loadSourceStocks() {
      setStockLoading(true);
      setSourceStocks([]);

      try {
        const response =
          sourceType === "SHOP"
            ? await getShopStocks(sourceId)
            : await getWarehouseStocks(sourceId);

        if (cancelled) return;

        setSourceStocks(extractStocks(response));
      } catch (error) {
        if (!cancelled) {
          setSourceStocks([]);
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load source stock."
          );
        }
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    }

    loadSourceStocks();

    return () => {
      cancelled = true;
    };
  }, [sourceId, sourceType, type, showProductsSection]);

  /* ------------------------------------------------------------------------ */
  /* Source products                                                          */
  /* ------------------------------------------------------------------------ */

  const sourceProductMap = new Map<string, SourceProduct>();

  for (const stock of sourceStocks) {
    const existing = sourceProductMap.get(stock.product_id);

    if (existing) {
      const alreadyExists = existing.variations.some(
        (variation) => variation.variation_id === stock.variation_id
      );

      if (!alreadyExists) {
        existing.variations.push({
          variation_id: stock.variation_id,
          sku: stock.sku,
          size: stock.size ?? "",
          color: stock.color ?? "",
        });
      }
    } else {
      sourceProductMap.set(stock.product_id, {
        guid: stock.product_id,
        name: stock.product_name,
        variations: [
          {
            variation_id: stock.variation_id,
            sku: stock.sku,
            size: stock.size ?? "",
            color: stock.color ?? "",
          },
        ],
      });
    }
  }

  const sourceProducts = Array.from(sourceProductMap.values());

  /* ------------------------------------------------------------------------ */
  /* Selected product                                                         */
  /* ------------------------------------------------------------------------ */

  const selectedReceiptProduct = receiptProducts.find(
    (product) => product.guid === selectedProductId
  );

  const selectedSourceProduct = sourceProducts.find(
    (product) => product.guid === selectedProductId
  );

  /* ------------------------------------------------------------------------ */
  /* Variations                                                               */
  /* ------------------------------------------------------------------------ */

  const variations: NormalizedVariation[] =
    type === "RECEIPT"
      ? (selectedReceiptProduct?.variations ?? []).map((variation) => ({
          guid: variation.guid,
          sku: variation.sku ?? "",
          size: variation.size ?? "",
          color: variation.color ?? "",
        }))
      : (selectedSourceProduct?.variations ?? []).map((variation) => ({
          guid: variation.variation_id,
          sku: variation.sku ?? "",
          size: variation.size ?? "",
          color: variation.color ?? "",
        }));

  const uniqueVariations = Array.from(
    new Map(variations.map((variation) => [variation.guid, variation])).values()
  );

  const selectedProduct =
    type === "RECEIPT" ? selectedReceiptProduct : selectedSourceProduct;

  const productsForSelection =
    type === "RECEIPT" ? receiptProducts : sourceProducts;

  /* ------------------------------------------------------------------------ */
  /* Helpers                                                                  */
  /* ------------------------------------------------------------------------ */

  function clearItems() {
    setItems([]);
  }

  function clearSourceSelection() {
    setSelectedProductId("");
    setSelectedVariationId("");
    clearItems();
  }

  /* ------------------------------------------------------------------------ */
  /* Merchant — apply (haqiqiy o'zgartirish)                                  */
  /* ------------------------------------------------------------------------ */

  function applyMerchantChange(newMerchantId: string) {
    setSelectedMerchantId(newMerchantId);

    setSourceId("");
    setDestinationId("");

    clearSourceSelection();

    setSourceStocks([]);
    setReceiptProducts([]);

    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* Merchant — intercept (edit rejimida tasdiqlash so'raladi)                */
  /* ------------------------------------------------------------------------ */

  function handleMerchantChange(newMerchantId: string) {
    if (isEditMode && newMerchantId !== selectedMerchantId) {
      setPendingSourceChange({ kind: "merchant", newMerchantId });
      return;
    }

    applyMerchantChange(newMerchantId);
  }

  /* ------------------------------------------------------------------------ */
  /* Movement type                                                            */
  /* ------------------------------------------------------------------------ */

  function handleTypeChange(newType: MovementType) {
    if (isShopManager && newType === "RECEIPT") return;

    setType(newType);

    const newSourceId =
      newType === "SALE" ||
      newType === "RETURN" ||
      (newType === "TRANSFER" && isShopManager)
        ? shopId ?? ""
        : "";

    setSourceId(newSourceId);
    setDestinationId("");

    setSelectedProductId("");
    setSelectedVariationId("");

    clearItems();
    setSourceStocks([]);
    setReceiptProducts([]);
    setError("");

    if (newType === "SALE") {
      setSourceType("SHOP");
      setDestinationType("SHOP");
    }

    if (newType === "RECEIPT") {
      setSourceType("WAREHOUSE");
      setDestinationType("WAREHOUSE");
    }

    if (newType === "RETURN") {
      setSourceType("SHOP");
      setDestinationType("WAREHOUSE");
    }

    if (newType === "TRANSFER") {
      if (isShopManager) {
        setSourceType("SHOP");
        setDestinationType("SHOP");
      } else {
        setSourceType("SHOP");
        setDestinationType("WAREHOUSE");
      }
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Source — apply (haqiqiy o'zgartirish, tasdiqlangandan keyin ishlaydi)    */
  /* ------------------------------------------------------------------------ */

  function applySourceChange(locationId: string) {
    setSourceId(locationId);
    clearSourceSelection();
    setSourceStocks([]);
    setError("");
  }

  function applySourceTypeChange(newSourceType: LocationType) {
    setSourceType(newSourceType);
    setSourceId("");
    clearSourceSelection();
    setSourceStocks([]);
    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* Source — intercept (edit rejimida tasdiqlash so'raladi)                  */
  /* ------------------------------------------------------------------------ */

  function handleSourceTypeChange(newSourceType: LocationType) {
    if (isEditMode && newSourceType !== sourceType) {
      setPendingSourceChange({ kind: "type", newSourceType });
      return;
    }

    applySourceTypeChange(newSourceType);
  }

  function handleSourceChange(locationId: string) {
    if (isShopManager && locationId !== shopId) return;

    if (isEditMode && locationId !== sourceId) {
      setPendingSourceChange({ kind: "location", locationId });
      return;
    }

    applySourceChange(locationId);
  }

  /* ------------------------------------------------------------------------ */
  /* Pending change confirmation                                              */
  /* ------------------------------------------------------------------------ */

  function handleConfirmSourceChange() {
    if (!pendingSourceChange) return;

    if (pendingSourceChange.kind === "location") {
      applySourceChange(pendingSourceChange.locationId);
    } else if (pendingSourceChange.kind === "type") {
      applySourceTypeChange(pendingSourceChange.newSourceType);
    } else {
      applyMerchantChange(pendingSourceChange.newMerchantId);
    }

    setPendingSourceChange(null);
  }

  function handleCancelSourceChange() {
    /*
     * Hech qanday state o'zgartirilmagan (faqat pendingSourceChange
     * o'rnatilgan edi), shuning uchun bekor qilish uchun uni tozalash
     * yetarli — barcha select'lar value={...} orqali eski qiymatlarga
     * bog'langani uchun ular ham avtomatik eski holatiga qaytadi.
     */
    setPendingSourceChange(null);
  }

  /* ------------------------------------------------------------------------ */
  /* Destination                                                               */
  /* ------------------------------------------------------------------------ */

  function handleDestinationChange(locationId: string) {
    if (isShopManager && destinationType === "SHOP" && locationId === shopId) {
      setError("You cannot transfer stock to your own shop.");
      return;
    }

    setDestinationId(locationId);

    if (type === "RECEIPT") {
      clearSourceSelection();
    }

    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* Product                                                                    */
  /* ------------------------------------------------------------------------ */

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    setSelectedVariationId("");
    setError("");
  }

  function handleVariationChange(variationId: string) {
    setSelectedVariationId(variationId);
    setError("");
  }

  /* ------------------------------------------------------------------------ */
  /* Add item                                                                  */
  /* ------------------------------------------------------------------------ */

  function handleAddItem() {
    setError("");

    if (!selectedProduct) {
      setError("Please select a product.");
      return;
    }

    if (!selectedVariationId) {
      setError("Please select a variation.");
      return;
    }

    if (quantity <= 0 || !Number.isFinite(quantity)) {
      setError("Quantity must be greater than 0.");
      return;
    }

    const alreadyExists = items.some(
      (item) => item.variationId === selectedVariationId
    );

    if (alreadyExists) {
      setError("This product variation is already added.");
      return;
    }

    if (type !== "RECEIPT") {
      const sourceStock = sourceStocks.find(
        (stock) => stock.variation_id === selectedVariationId
      );

      if (!sourceStock) {
        setError("Selected variation is not available in the source.");
        return;
      }

      if (quantity > sourceStock.quantity) {
        setError(`Available quantity: ${sourceStock.quantity}.`);
        return;
      }
    }

    const variation = uniqueVariations.find(
      (item) => item.guid === selectedVariationId
    );

    if (!variation) {
      setError("Variation not found.");
      return;
    }

    const newItem: SelectedItem = {
      variationId: variation.guid,
      productName: selectedProduct.name,
      sku: variation.sku,
      size: variation.size,
      color: variation.color,
      quantity,
    };

    setItems((current) => [...current, newItem]);

    setSelectedProductId("");
    setSelectedVariationId("");
    setQuantity(1);
  }

  /* ------------------------------------------------------------------------ */
  /* Remove item                                                               */
  /* ------------------------------------------------------------------------ */

  function handleRemoveItem(variationId: string) {
    setItems((current) =>
      current.filter((item) => item.variationId !== variationId)
    );
  }

  /* ------------------------------------------------------------------------ */
  /* CREATE                                                                     */
  /* ------------------------------------------------------------------------ */

  async function handleCreate() {
    setError("");

    if (!selectedMerchantId) {
      setError("Please select a merchant.");
      return;
    }

    if (isShopManager) {
      if (type !== "SALE" && type !== "RETURN" && type !== "TRANSFER") {
        setError("You are not allowed to create this movement type.");
        return;
      }

      if (sourceId !== shopId) {
        setError("You can only use your own shop as the source.");
        return;
      }

      if (type === "TRANSFER" && destinationType !== "SHOP") {
        setError("Shop Manager can only transfer stock to another shop.");
        return;
      }

      if (type === "TRANSFER" && destinationId === shopId) {
        setError("You cannot transfer stock to your own shop.");
        return;
      }
    }

    if (type === "SALE" && !sourceId) {
      setError("Please select a shop.");
      return;
    }

    if (type === "RECEIPT" && !destinationId) {
      setError("Please select a warehouse.");
      return;
    }

    if (type === "RETURN") {
      if (!sourceId) {
        setError("Please select a source shop.");
        return;
      }

      if (!destinationId) {
        setError("Please select a destination warehouse.");
        return;
      }
    }

    if (type === "TRANSFER") {
      if (!sourceId) {
        setError("Please select a source.");
        return;
      }

      if (!destinationId) {
        setError("Please select a destination.");
        return;
      }

      if (sourceType === destinationType && sourceId === destinationId) {
        setError("Source and destination cannot be the same.");
        return;
      }
    }

    if (items.length === 0) {
      setError("Please add at least one product.");
      return;
    }

    const request: CreateStockMovementRequest = {
      merchants_id: selectedMerchantId,
      type,
      items: items.map(
        (item): CreateStockMovementItem => ({
          product_variations_id: item.variationId,
          quantity: item.quantity,
        })
      ),
    };

    if (type === "SALE") request.shops_id = sourceId;
    if (type === "RECEIPT") request.warehouse_id_2 = destinationId;

    if (type === "RETURN") {
      request.shops_id = sourceId;
      request.warehouse_id_2 = destinationId;
    }

    if (type === "TRANSFER") {
      if (sourceType === "SHOP") {
        request.shops_id = sourceId;
      } else {
        request.warehouse_id = sourceId;
      }

      if (destinationType === "SHOP") {
        request.shops_id_2 = destinationId;
      } else {
        request.warehouse_id_2 = destinationId;
      }
    }

    setLoading(true);

    try {
      await createStockMovement(request);
      await onCreated();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create stock movement."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* EDIT                                                                      */
  /* ------------------------------------------------------------------------ */

  async function handleEdit() {
    if (!movement) return;

    if (movement.status !== "DRAFT") {
      setError("Only draft movements can be edited.");
      return;
    }

    if (!selectedMerchantId) {
      setError("Please select a merchant.");
      return;
    }

    if (isShopManager) {
      if (type !== "SALE" && type !== "RETURN" && type !== "TRANSFER") {
        setError("You are not allowed to use this movement type.");
        return;
      }

      if (sourceId !== shopId) {
        setError("You can only use your own shop as the source.");
        return;
      }

      if (type === "TRANSFER" && destinationType !== "SHOP") {
        setError("Shop Manager can only transfer stock to another shop.");
        return;
      }

      if (type === "TRANSFER" && destinationId === shopId) {
        setError("You cannot transfer stock to your own shop.");
        return;
      }
    }

    if (type === "SALE" && !sourceId) {
      setError("Please select a shop.");
      return;
    }

    if (type === "RECEIPT" && !destinationId) {
      setError("Please select a warehouse.");
      return;
    }

    if (type === "RETURN") {
      if (!sourceId) {
        setError("Please select a source shop.");
        return;
      }

      if (!destinationId) {
        setError("Please select a destination warehouse.");
        return;
      }
    }

    if (type === "TRANSFER") {
      if (!sourceId) {
        setError("Please select a source.");
        return;
      }

      if (!destinationId) {
        setError("Please select a destination.");
        return;
      }

      if (sourceType === destinationType && sourceId === destinationId) {
        setError("Source and destination cannot be the same.");
        return;
      }
    }

    if (sourceChanged && items.length === 0) {
      setError(
        "Source changed. Please add at least one product from the new source before saving."
      );
      return;
    }

    const request: UpdateStockMovementRequest = {
      stock_movement_id: movement.id,
      type,
    };

    if (type === "SALE") request.shops_id = sourceId;
    if (type === "RECEIPT") request.warehouse_id_2 = destinationId;

    if (type === "RETURN") {
      request.shops_id = sourceId;
      request.warehouse_id_2 = destinationId;
    }

    if (type === "TRANSFER") {
      if (sourceType === "SHOP") {
        request.shops_id = sourceId;
      } else {
        request.warehouse_id = sourceId;
      }

      if (destinationType === "SHOP") {
        request.shops_id_2 = destinationId;
      } else {
        request.warehouse_id_2 = destinationId;
      }
    }

    if (sourceChanged) {
      request.items = items.map(
        (item): CreateStockMovementItem => ({
          product_variations_id: item.variationId,
          quantity: item.quantity,
        })
      );
    }

    setLoading(true);

    try {
      await updateStockMovement(request);
      await onCreated();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update stock movement."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Submit                                                                    */
  /* ------------------------------------------------------------------------ */

  async function handleSubmit() {
    setError("");

    if (isEditMode) {
      await handleEdit();
      return;
    }

    await handleCreate();
  }

  /* ------------------------------------------------------------------------ */
  /* Product selection                                                         */
  /* ------------------------------------------------------------------------ */

  const productSelectionDisabled =
    type === "RECEIPT" ? !destinationId : !sourceId;

  /* ------------------------------------------------------------------------ */
  /* UI                                                                        */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            {isEditMode ? "Edit Stock Movement" : "Create Stock Movement"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {/* Merchant */}

          {!isShopManager && (
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Merchant
              </label>

              <select
                value={selectedMerchantId}
                onChange={(e) => handleMerchantChange(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
              >
                <option value="">Select merchant</option>

                {merchants.map((merchant) => (
                  <option key={merchant.guid} value={merchant.guid}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Movement Type */}

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Movement Type
            </label>

            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as MovementType)}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
            >
              <option value="TRANSFER">Transfer</option>
              <option value="SALE">Sale</option>
              {!isShopManager && <option value="RECEIPT">Receipt</option>}
              <option value="RETURN">Return</option>
            </select>
          </div>

          {/* SALE */}

          {type === "SALE" && (
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Source Shop
              </label>

              {isShopManager ? (
                <div className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700">
                  {shops.find((shop) => shop.guid === shopId)?.name}
                </div>
              ) : (
                <select
                  value={sourceId}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  disabled={!selectedMerchantId || loading}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                >
                  <option value="">Select shop</option>

                  {merchantShops.map((shop) => (
                    <option key={shop.guid} value={shop.guid}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* RECEIPT */}

          {type === "RECEIPT" && !isShopManager && (
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Destination Warehouse
              </label>

              <select
                value={destinationId}
                onChange={(e) => handleDestinationChange(e.target.value)}
                disabled={!selectedMerchantId || loading}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
              >
                <option value="">Select warehouse</option>

                {merchantWarehouses.map((warehouse) => (
                  <option key={warehouse.guid} value={warehouse.guid}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* RETURN */}

          {type === "RETURN" && (
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Source Shop */}

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Source Shop
                </label>

                {isShopManager ? (
                  <div className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700">
                    {shops.find((shop) => shop.guid === shopId)?.name}
                  </div>
                ) : (
                  <select
                    value={sourceId}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    disabled={!selectedMerchantId || loading}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                  >
                    <option value="">Select shop</option>

                    {merchantShops.map((shop) => (
                      <option key={shop.guid} value={shop.guid}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destination Warehouse */}

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Destination Warehouse
                </label>

                <select
                  value={destinationId}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  disabled={!selectedMerchantId || loading}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                >
                  <option value="">Select warehouse</option>

                  {merchantWarehouses.map((warehouse) => (
                    <option key={warehouse.guid} value={warehouse.guid}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TRANSFER */}

          {type === "TRANSFER" && (
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Source */}

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Source
                </label>

                {!isShopManager && (
                  <div className="mb-2">
                    <select
                      value={sourceType}
                      onChange={(e) =>
                        handleSourceTypeChange(e.target.value as LocationType)
                      }
                      disabled={loading}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                    >
                      <option value="SHOP">Shop</option>
                      <option value="WAREHOUSE">Warehouse</option>
                    </select>
                  </div>
                )}

                {isShopManager ? (
                  <div className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700">
                    {shops.find((shop) => shop.guid === shopId)?.name}
                  </div>
                ) : (
                  <select
                    value={sourceId}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    disabled={!selectedMerchantId || loading}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                  >
                    <option value="">Select source</option>

                    {sourceOptions.map((location) => (
                      <option key={location.guid} value={location.guid}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destination */}

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Destination
                </label>

                {!isShopManager && (
                  <div className="mb-2">
                    <select
                      value={destinationType}
                      onChange={(e) => {
                        setDestinationType(e.target.value as LocationType);
                        setDestinationId("");
                        setError("");
                      }}
                      disabled={loading}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                    >
                      <option value="SHOP">Shop</option>
                      <option value="WAREHOUSE">Warehouse</option>
                    </select>
                  </div>
                )}

                <select
                  value={destinationId}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  disabled={!selectedMerchantId || loading}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                >
                  <option value="">Select destination</option>

                  {destinationOptions.map((location) => (
                    <option key={location.guid} value={location.guid}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Products */}

          {showProductsSection && (
            <div className="border-t border-zinc-200 pt-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Products
              </h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* Product */}

                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  disabled={
                    productSelectionDisabled ||
                    stockLoading ||
                    receiptProductsLoading ||
                    !selectedMerchantId
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">
                    {stockLoading
                      ? "Loading stock..."
                      : receiptProductsLoading
                        ? "Loading products..."
                        : "Select product"}
                  </option>

                  {productsForSelection.map((product) => (
                    <option key={product.guid} value={product.guid}>
                      {product.name}
                    </option>
                  ))}
                </select>

                {/* Variation */}

                <select
                  value={selectedVariationId}
                  onChange={(e) => handleVariationChange(e.target.value)}
                  disabled={
                    !selectedProductId ||
                    stockLoading ||
                    receiptProductsLoading
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">Select variation</option>

                  {uniqueVariations.map((variation) => (
                    <option key={variation.guid} value={variation.guid}>
                      {variation.sku}
                      {variation.size ? ` - ${variation.size}` : ""}
                      {variation.color ? ` - ${variation.color}` : ""}
                    </option>
                  ))}
                </select>

                {/* Quantity */}

                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  disabled={
                    stockLoading ||
                    receiptProductsLoading ||
                    !selectedVariationId
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
                />
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                disabled={
                  !selectedVariationId ||
                  stockLoading ||
                  receiptProductsLoading ||
                  loading
                }
                className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>
          )}

          {/* Selected Items */}

          {showProductsSection && items.length > 0 && (
            <div className="mt-5 border-t border-zinc-200 pt-5">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                Selected Products
              </h3>

              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.variationId}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {item.productName}
                      </p>

                      <p className="text-xs text-zinc-500">
                        SKU: {item.sku}
                        {item.size && ` • Size: ${item.size}`}
                        {item.color && ` • Color: ${item.color}`}
                        {` • Qty: ${item.quantity}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.variationId)}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit information — faqat source o'zgarmagan bo'lsa ko'rsatiladi */}

          {isEditMode && !sourceChanged && (
            <div className="border-t border-zinc-200 pt-5">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">Products</p>

                <p className="mt-1 text-xs text-zinc-500">
                  Existing products are kept. To add or remove individual
                  products, use the movement details page instead.
                </p>
              </div>
            </div>
          )}

          {/* Error */}

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !selectedMerchantId}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? isEditMode
                ? "Saving..."
                : "Creating..."
              : isEditMode
                ? "Save Changes"
                : "Create Movement"}
          </button>
        </div>
      </div>

      {/* Source / Merchant Change Warning */}

      {pendingSourceChange && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="px-6 py-6">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <AlertTriangle size={26} className="text-amber-600" />
                </div>

                <div className="pt-1">
                  <h3 className="text-xl font-bold text-zinc-900">
                    Warning: Source will change
                  </h3>

                  <p className="mt-2 text-base leading-relaxed text-zinc-700">
                    Changing the {pendingSourceChange.kind === "merchant" ? "merchant" : "source"} will{" "}
                    <span className="font-semibold text-zinc-900">
                      clear all currently selected products
                    </span>
                    . You will need to re-select products from the new
                    source before you can save this movement.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
              <button
                type="button"
                onClick={handleCancelSourceChange}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSourceChange}
                className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                OK, change it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}