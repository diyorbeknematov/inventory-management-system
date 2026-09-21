import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

import {
  createStockMovement,
  updateStockMovement,
} from "../../api/movements";

import type {
  MovementType,
  FrontendMovement,
  CreateStockMovementItem,
  CreateStockMovementRequest,
  UpdateStockMovementRequest,
} from "../../types/movement";

import type { Shop } from "../../types/shop";
import type { Warehouse } from "../../types/warehouse";
import type { Product } from "../../types/products";

type Props = {
  shops: Shop[];
  warehouses: Warehouse[];
  products: Product[];
  merchantId: string;
  shopId?: string;

  movement?: FrontendMovement;

  onClose: () => void;
  onCreated: () => Promise<void>;
};

type LocationType = "SHOP" | "WAREHOUSE";

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

export default function AddMovementModal({
  shops,
  warehouses,
  products,
  merchantId,
  shopId,
  movement,
  onClose,
  onCreated,
}: Props) {
  const isShopManager = Boolean(shopId);
  const isEditMode = Boolean(movement);

  /*
   * --------------------------------------------------------------------------
   * Initial values
   * --------------------------------------------------------------------------
   */

  const initialSourceType: LocationType =
    movement?.from.type === "WAREHOUSE"
      ? "WAREHOUSE"
      : "SHOP";

  const initialDestinationType: LocationType =
    movement?.to.type === "WAREHOUSE"
      ? "WAREHOUSE"
      : "SHOP";

  const initialSourceId =
    movement &&
    (movement.from.type === "SHOP" ||
      movement.from.type === "WAREHOUSE")
      ? movement.from.id
      : shopId ?? "";

  const initialDestinationId =
    movement &&
    (movement.to.type === "SHOP" ||
      movement.to.type === "WAREHOUSE")
      ? movement.to.id
      : "";

  /*
   * --------------------------------------------------------------------------
   * State
   * --------------------------------------------------------------------------
   */

  const [type, setType] = useState<MovementType>(
    movement?.type ?? "TRANSFER"
  );

  const [sourceType, setSourceType] =
    useState<LocationType>(
      isEditMode
        ? initialSourceType
        : isShopManager
          ? "SHOP"
          : "SHOP"
    );

  const [destinationType, setDestinationType] =
    useState<LocationType>(
      isEditMode
        ? initialDestinationType
        : isShopManager
          ? "SHOP"
          : "WAREHOUSE"
    );

  const [sourceId, setSourceId] = useState(
    initialSourceId
  );

  const [destinationId, setDestinationId] =
    useState(initialDestinationId);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [selectedVariationId, setSelectedVariationId] =
    useState("");

  const [items, setItems] = useState<SelectedItem[]>(
    []
  );

  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * --------------------------------------------------------------------------
   * Shop Manager permissions
   * --------------------------------------------------------------------------
   */

  const availableShops = isShopManager
    ? shops.filter(
        (shop) => shop.guid !== shopId
      )
    : shops;

  /*
   * --------------------------------------------------------------------------
   * Source / Destination options
   * --------------------------------------------------------------------------
   */

  const sourceOptions =
    sourceType === "SHOP"
      ? shops
      : warehouses;

  const destinationOptions =
    destinationType === "SHOP"
      ? availableShops
      : warehouses;

  /*
   * --------------------------------------------------------------------------
   * Selected source
   * --------------------------------------------------------------------------
   */

  const selectedSource =
    sourceType === "SHOP"
      ? shops.find(
          (shop) => shop.guid === sourceId
        )
      : warehouses.find(
          (warehouse) =>
            warehouse.guid === sourceId
        );

  const sourceStocks =
    selectedSource?.stocks ?? [];

  /*
   * --------------------------------------------------------------------------
   * Products available from source
   * --------------------------------------------------------------------------
   */

  const sourceProductMap = new Map<
    string,
    SourceProduct
  >();

  for (const stock of sourceStocks) {
    const existing = sourceProductMap.get(
      stock.product_id
    );

    if (existing) {
      const alreadyExists =
        existing.variations.some(
          (variation) =>
            variation.variation_id ===
            stock.variation_id
        );

      if (!alreadyExists) {
        existing.variations.push({
          variation_id:
            stock.variation_id,
          sku: stock.sku,
          size: stock.size,
          color: stock.color,
        });
      }
    } else {
      sourceProductMap.set(
        stock.product_id,
        {
          guid: stock.product_id,
          name: stock.product_name,
          variations: [
            {
              variation_id:
                stock.variation_id,
              sku: stock.sku,
              size: stock.size,
              color: stock.color,
            },
          ],
        }
      );
    }
  }

  const sourceProducts = Array.from(
    sourceProductMap.values()
  );

  /*
   * --------------------------------------------------------------------------
   * Receipt products
   * --------------------------------------------------------------------------
   */

  const selectedReceiptProduct =
    products.find(
      (product) =>
        product.guid === selectedProductId
    );

  const selectedSourceProduct =
    sourceProducts.find(
      (product) =>
        product.guid === selectedProductId
    );

  const variations: NormalizedVariation[] =
    type === "RECEIPT"
      ? (
          selectedReceiptProduct?.variations ??
          []
        ).map((variation) => ({
          guid: variation.guid,
          sku: variation.sku ?? "",
          size: variation.size ?? "",
          color: variation.color ?? "",
        }))
      : (
          selectedSourceProduct?.variations ??
          []
        ).map((variation) => ({
          guid: variation.variation_id,
          sku: variation.sku ?? "",
          size: variation.size ?? "",
          color: variation.color ?? "",
        }));

  const uniqueVariations = Array.from(
    new Map(
      variations.map((variation) => [
        variation.guid,
        variation,
      ])
    ).values()
  );

  const selectedProduct =
    type === "RECEIPT"
      ? selectedReceiptProduct
      : selectedSourceProduct;

  const productsForSelection =
    type === "RECEIPT"
      ? products
      : sourceProducts;

  /*
   * --------------------------------------------------------------------------
   * Helpers
   * --------------------------------------------------------------------------
   */

  function clearItems() {
    setItems([]);
  }

  /*
   * --------------------------------------------------------------------------
   * Movement type
   * --------------------------------------------------------------------------
   */

  function handleTypeChange(
    newType: MovementType
  ) {
    /*
     * Shop Manager cannot create/edit RECEIPT.
     */
    if (
      isShopManager &&
      newType === "RECEIPT"
    ) {
      return;
    }

    setType(newType);

    /*
     * SALE / RETURN:
     * source is own shop for Shop Manager.
     */
    setSourceId(
      newType === "SALE" ||
        newType === "RETURN" ||
        (
          newType === "TRANSFER" &&
          isShopManager
        )
        ? shopId ?? ""
        : ""
    );

    setDestinationId("");

    setSelectedProductId("");
    setSelectedVariationId("");

    clearItems();
    setError("");

    /*
     * SALE
     */
    if (newType === "SALE") {
      setSourceType("SHOP");
    }

    /*
     * RECEIPT
     */
    if (newType === "RECEIPT") {
      setSourceType("WAREHOUSE");
      setDestinationType("WAREHOUSE");
    }

    /*
     * RETURN
     */
    if (newType === "RETURN") {
      setSourceType("SHOP");
      setDestinationType("WAREHOUSE");
    }

    /*
     * TRANSFER
     */
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

  /*
   * --------------------------------------------------------------------------
   * Source change
   * --------------------------------------------------------------------------
   */

  function handleSourceChange(
    locationId: string
  ) {
    /*
     * Shop Manager can only use own shop.
     */
    if (
      isShopManager &&
      locationId !== shopId
    ) {
      return;
    }

    setSourceId(locationId);

    setSelectedProductId("");
    setSelectedVariationId("");

    clearItems();
    setError("");
  }

  /*
   * --------------------------------------------------------------------------
   * Destination change
   * --------------------------------------------------------------------------
   */

  function handleDestinationChange(
    locationId: string
  ) {
    /*
     * Shop Manager cannot transfer to own shop.
     */
    if (
      isShopManager &&
      destinationType === "SHOP" &&
      locationId === shopId
    ) {
      setError(
        "You cannot transfer stock to your own shop."
      );

      return;
    }

    setDestinationId(locationId);

    if (type === "RECEIPT") {
      setSelectedProductId("");
      setSelectedVariationId("");
      clearItems();
    }

    setError("");
  }

  /*
   * --------------------------------------------------------------------------
   * Product
   * --------------------------------------------------------------------------
   */

  function handleProductChange(
    productId: string
  ) {
    setSelectedProductId(productId);
    setSelectedVariationId("");
    setError("");
  }

  /*
   * --------------------------------------------------------------------------
   * Variation
   * --------------------------------------------------------------------------
   */

  function handleVariationChange(
    variationId: string
  ) {
    setSelectedVariationId(variationId);
    setError("");
  }

  /*
   * --------------------------------------------------------------------------
   * Add item
   * --------------------------------------------------------------------------
   */

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

    if (quantity <= 0) {
      setError(
        "Quantity must be greater than 0."
      );

      return;
    }

    const alreadyExists = items.some(
      (item) =>
        item.variationId ===
        selectedVariationId
    );

    if (alreadyExists) {
      setError(
        "This product variation is already added."
      );

      return;
    }

    const variation =
      uniqueVariations.find(
        (item) =>
          item.guid === selectedVariationId
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

    setItems((current) => [
      ...current,
      newItem,
    ]);

    setSelectedProductId("");
    setSelectedVariationId("");
    setQuantity(1);
  }

  /*
   * --------------------------------------------------------------------------
   * Remove item
   * --------------------------------------------------------------------------
   */

  function handleRemoveItem(
    variationId: string
  ) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.variationId !==
          variationId
      )
    );
  }

  /*
   * --------------------------------------------------------------------------
   * CREATE
   * --------------------------------------------------------------------------
   */

  async function handleCreate() {
    /*
     * Shop Manager permissions
     */

    if (isShopManager) {
      if (
        type !== "SALE" &&
        type !== "RETURN" &&
        type !== "TRANSFER"
      ) {
        setError(
          "You are not allowed to create this movement type."
        );

        return;
      }

      if (sourceId !== shopId) {
        setError(
          "You can only use your own shop as the source."
        );

        return;
      }

      if (
        type === "TRANSFER" &&
        destinationType !== "SHOP"
      ) {
        setError(
          "Shop Manager can only transfer stock to another shop."
        );

        return;
      }

      if (
        type === "TRANSFER" &&
        destinationId === shopId
      ) {
        setError(
          "You cannot transfer stock to your own shop."
        );

        return;
      }
    }

    /*
     * SALE
     */

    if (type === "SALE") {
      if (!sourceId) {
        setError(
          "Please select a shop."
        );

        return;
      }
    }

    /*
     * RECEIPT
     */

    if (type === "RECEIPT") {
      if (!destinationId) {
        setError(
          "Please select a warehouse."
        );

        return;
      }
    }

    /*
     * RETURN
     */

    if (type === "RETURN") {
      if (!sourceId) {
        setError(
          "Please select a source shop."
        );

        return;
      }

      if (!destinationId) {
        setError(
          "Please select a destination warehouse."
        );

        return;
      }
    }

    /*
     * TRANSFER
     */

    if (type === "TRANSFER") {
      if (!sourceId) {
        setError(
          "Please select a source."
        );

        return;
      }

      if (!destinationId) {
        setError(
          "Please select a destination."
        );

        return;
      }

      if (
        sourceType === destinationType &&
        sourceId === destinationId
      ) {
        setError(
          "Source and destination cannot be the same."
        );

        return;
      }
    }

    const request: CreateStockMovementRequest =
      {
        merchants_id: merchantId,
        type,

        items: items.map(
          (
            item
          ): CreateStockMovementItem => ({
            product_variations_id:
              item.variationId,
            quantity: item.quantity,
          })
        ),
      };

    /*
     * SALE
     */

    if (type === "SALE") {
      request.shops_id = sourceId;
    }

    /*
     * RECEIPT
     */

    if (type === "RECEIPT") {
      request.warehouse_id_2 =
        destinationId;
    }

    /*
     * RETURN
     */

    if (type === "RETURN") {
      request.shops_id = sourceId;
      request.warehouse_id_2 =
        destinationId;
    }

    /*
     * TRANSFER
     */

    if (type === "TRANSFER") {
      if (sourceType === "SHOP") {
        request.shops_id = sourceId;
      } else {
        request.warehouse_id =
          sourceId;
      }

      if (destinationType === "SHOP") {
        request.shops_id_2 =
          destinationId;
      } else {
        request.warehouse_id_2 =
          destinationId;
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

  /*
   * --------------------------------------------------------------------------
   * EDIT
   * --------------------------------------------------------------------------
   */

  async function handleEdit() {
    if (!movement) {
      return;
    }

    /*
     * Only DRAFT can be edited.
     */

    if (movement.status !== "DRAFT") {
      setError(
        "Only draft movements can be edited."
      );

      return;
    }

    /*
     * Shop Manager permissions
     */

    if (isShopManager) {
      if (
        type !== "SALE" &&
        type !== "RETURN" &&
        type !== "TRANSFER"
      ) {
        setError(
          "You are not allowed to use this movement type."
        );

        return;
      }

      if (sourceId !== shopId) {
        setError(
          "You can only use your own shop as the source."
        );

        return;
      }

      if (
        type === "TRANSFER" &&
        destinationType !== "SHOP"
      ) {
        setError(
          "Shop Manager can only transfer stock to another shop."
        );

        return;
      }

      if (
        type === "TRANSFER" &&
        destinationId === shopId
      ) {
        setError(
          "You cannot transfer stock to your own shop."
        );

        return;
      }
    }

    /*
     * SALE
     */

    if (type === "SALE") {
      if (!sourceId) {
        setError(
          "Please select a shop."
        );

        return;
      }
    }

    /*
     * RECEIPT
     */

    if (type === "RECEIPT") {
      if (!destinationId) {
        setError(
          "Please select a warehouse."
        );

        return;
      }
    }

    /*
     * RETURN
     */

    if (type === "RETURN") {
      if (!sourceId) {
        setError(
          "Please select a source shop."
        );

        return;
      }

      if (!destinationId) {
        setError(
          "Please select a destination warehouse."
        );

        return;
      }
    }

    /*
     * TRANSFER
     */

    if (type === "TRANSFER") {
      if (!sourceId) {
        setError(
          "Please select a source."
        );

        return;
      }

      if (!destinationId) {
        setError(
          "Please select a destination."
        );

        return;
      }

      if (
        sourceType === destinationType &&
        sourceId === destinationId
      ) {
        setError(
          "Source and destination cannot be the same."
        );

        return;
      }
    }

    const request: UpdateStockMovementRequest =
      {
        stock_movement_id: movement.id,
        type,
      };

    /*
     * SALE
     */

    if (type === "SALE") {
      request.shops_id = sourceId;
    }

    /*
     * RECEIPT
     */

    if (type === "RECEIPT") {
      request.warehouse_id_2 =
        destinationId;
    }

    /*
     * RETURN
     */

    if (type === "RETURN") {
      request.shops_id = sourceId;
      request.warehouse_id_2 =
        destinationId;
    }

    /*
     * TRANSFER
     */

    if (type === "TRANSFER") {
      if (sourceType === "SHOP") {
        request.shops_id = sourceId;
      } else {
        request.warehouse_id =
          sourceId;
      }

      if (destinationType === "SHOP") {
        request.shops_id_2 =
          destinationId;
      } else {
        request.warehouse_id_2 =
          destinationId;
      }
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

  /*
   * --------------------------------------------------------------------------
   * Submit
   * --------------------------------------------------------------------------
   */

  async function handleSubmit() {
    setError("");

    if (isEditMode) {
      await handleEdit();
      return;
    }

    await handleCreate();
  }

  /*
   * --------------------------------------------------------------------------
   * Product selection
   * --------------------------------------------------------------------------
   */

  const productSelectionDisabled =
    type === "RECEIPT"
      ? !destinationId
      : !sourceId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            {isEditMode
              ? "Edit Stock Movement"
              : "Create Stock Movement"}
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

          {/* Movement Type */}

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Movement Type
            </label>

            <select
              value={type}
              onChange={(e) =>
                handleTypeChange(
                  e.target.value as MovementType
                )
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
            >
              <option value="TRANSFER">
                Transfer
              </option>

              <option value="SALE">
                Sale
              </option>

              {!isShopManager && (
                <option value="RECEIPT">
                  Receipt
                </option>
              )}

              <option value="RETURN">
                Return
              </option>
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
                  {
                    shops.find(
                      (shop) =>
                        shop.guid === shopId
                    )?.name
                  }
                </div>
              ) : (
                <select
                  value={sourceId}
                  onChange={(e) =>
                    handleSourceChange(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">
                    Select shop
                  </option>

                  {shops.map((shop) => (
                    <option
                      key={shop.guid}
                      value={shop.guid}
                    >
                      {shop.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* RECEIPT */}

          {type === "RECEIPT" &&
            !isShopManager && (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Destination Warehouse
                </label>

                <select
                  value={destinationId}
                  onChange={(e) =>
                    handleDestinationChange(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">
                    Select warehouse
                  </option>

                  {warehouses.map(
                    (warehouse) => (
                      <option
                        key={warehouse.guid}
                        value={warehouse.guid}
                      >
                        {warehouse.name}
                      </option>
                    )
                  )}
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
                    {
                      shops.find(
                        (shop) =>
                          shop.guid === shopId
                      )?.name
                    }
                  </div>
                ) : (
                  <select
                    value={sourceId}
                    onChange={(e) =>
                      handleSourceChange(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                  >
                    <option value="">
                      Select shop
                    </option>

                    {shops.map((shop) => (
                      <option
                        key={shop.guid}
                        value={shop.guid}
                      >
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
                  onChange={(e) =>
                    handleDestinationChange(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">
                    Select warehouse
                  </option>

                  {warehouses.map(
                    (warehouse) => (
                      <option
                        key={warehouse.guid}
                        value={warehouse.guid}
                      >
                        {warehouse.name}
                      </option>
                    )
                  )}
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
                      onChange={(e) => {
                        setSourceType(
                          e.target.value as LocationType
                        );

                        setSourceId("");

                        setSelectedProductId("");
                        setSelectedVariationId("");

                        clearItems();
                        setError("");
                      }}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                    >
                      <option value="SHOP">
                        Shop
                      </option>

                      <option value="WAREHOUSE">
                        Warehouse
                      </option>
                    </select>
                  </div>
                )}

                {isShopManager ? (
                  <div className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700">
                    {
                      shops.find(
                        (shop) =>
                          shop.guid === shopId
                      )?.name
                    }
                  </div>
                ) : (
                  <select
                    value={sourceId}
                    onChange={(e) =>
                      handleSourceChange(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                  >
                    <option value="">
                      Select source
                    </option>

                    {sourceOptions.map(
                      (location) => (
                        <option
                          key={location.guid}
                          value={location.guid}
                        >
                          {location.name}
                        </option>
                      )
                    )}
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
                        setDestinationType(
                          e.target.value as LocationType
                        );

                        setDestinationId("");

                        setError("");
                      }}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                    >
                      <option value="SHOP">
                        Shop
                      </option>

                      <option value="WAREHOUSE">
                        Warehouse
                      </option>
                    </select>
                  </div>
                )}

                <select
                  value={destinationId}
                  onChange={(e) =>
                    handleDestinationChange(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">
                    Select destination
                  </option>

                  {destinationOptions.map(
                    (location) => (
                      <option
                        key={location.guid}
                        value={location.guid}
                      >
                        {location.name}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Products */}

          {!isEditMode && (
            <div className="border-t border-zinc-200 pt-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                Products
              </h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                {/* Product */}

                <select
                  value={selectedProductId}
                  onChange={(e) =>
                    handleProductChange(
                      e.target.value
                    )
                  }
                  disabled={
                    productSelectionDisabled
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">
                    Select product
                  </option>

                  {productsForSelection.map(
                    (product) => (
                      <option
                        key={product.guid}
                        value={product.guid}
                      >
                        {product.name}
                      </option>
                    )
                  )}
                </select>

                {/* Variation */}

                <select
                  value={selectedVariationId}
                  onChange={(e) =>
                    handleVariationChange(
                      e.target.value
                    )
                  }
                  disabled={!selectedProductId}
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">
                    Select variation
                  </option>

                  {uniqueVariations.map(
                    (variation) => (
                      <option
                        key={variation.guid}
                        value={variation.guid}
                      >
                        {variation.sku}

                        {variation.size
                          ? ` - ${variation.size}`
                          : ""}

                        {variation.color
                          ? ` - ${variation.color}`
                          : ""}
                      </option>
                    )
                  )}
                </select>

                {/* Quantity */}

                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Number(e.target.value)
                    )
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                />
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedVariationId}
                className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>
          )}

          {/* Selected Items */}

          {!isEditMode &&
            items.length > 0 && (
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

                          {item.size &&
                            ` • Size: ${item.size}`}

                          {item.color &&
                            ` • Color: ${item.color}`}

                          {` • Qty: ${item.quantity}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveItem(
                            item.variationId
                          )
                        }
                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Edit information */}

          {isEditMode && (
            <div className="border-t border-zinc-200 pt-5">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">
                  Products
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  Existing products are kept when editing
                  a movement.
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
            disabled={loading}
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
    </div>
  );
}