package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/spf13/cast"
)

// --------------------------
// GetWarehouseIncomingShipments
// ------------------------------
func GetWarehouseIncomingShipments(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetWarehouseIncomingShipments")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid", "name"},
		fmt.Sprintf("guid = '%s'", strings.ReplaceAll(merchantID, "'", "''")),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	// Warehuses
	warehouses, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{"guid", "name", "address"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	warehouseIDs := utils.GetIDs(warehouses, "guid")

	movementFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	movements, err := utils.SelectItems(
		request,
		"stock_movements",
		[]string{
			"guid",
			"warehouse_id_2",
			"type",
			"status",
		},
		movementFilter+
			" AND "+
			utils.BuildInClause("warehouse_id_2", warehouseIDs)+
			" AND 'RECEIPT' = ANY(type)",
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	movmentIDs := utils.GetIDs(movements, "guid")

	items, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
			"stock_movements_id",
			"product_variations_id",
			"quantity",
		},
		utils.BuildInClause("stock_movements_id", movmentIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationIDs := utils.GetIDs(items, "product_variations_id")

	variations, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
			"sku",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"size",
			"color",
		},
		utils.BuildInClause("guid", variationIDs),
		[]string{
			"guid",
			"products_id",
			"sku",
			"size",
			"color",
		},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(variations, "products_id")

	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"category_id",
		},
		utils.BuildInClause("guid", productIDs),
		[]string{
			"guid",
			"name",
			"category_id",
		},
	)
	if err != nil {
		return nil, err
	}

	itemsByMovement := utils.GroupBy(items, "stock_movements_id")

	variationByID := utils.GroupByID(variations, "guid")

	productByID := utils.GroupByID(products, "guid")

	movementsByWarehouse := utils.GroupBy(movements, "warehouse_id_2")

	for _, warehouse := range warehouses {
		warehouseID := cast.ToString(warehouse["guid"])

		warehouseMovements := movementsByWarehouse[warehouseID]

		shipments := make([]map[string]any, 0)

		for _, movement := range warehouseMovements {
			movementID := cast.ToString(movement["guid"])

			shipment := map[string]any{
				"guid":   movement["guid"],
				"type":   movement["type"],
				"status": movement["status"],
			}

			shipmentItems := make([]map[string]any, 0)

			for _, item := range itemsByMovement[movementID] {
				variationID := cast.ToString(item["product_variations_id"])

				variation := variationByID[variationID]
				if variation == nil {
					continue
				}

				productID := cast.ToString(variation["products_id"])

				product := productByID[productID]
				if product == nil {
					continue
				}

				shipmentItems = append(shipmentItems, map[string]any{
					"guid":         item["guid"],
					"product_id":   product["guid"],
					"product_name": product["name"],
					"variation_id": variation["guid"],
					"sku":          variation["sku"],
					"size":         variation["size"],
					"color":        variation["color"],
					"quantity":     item["quantity"],
					"images":       variation["images"],
				})
			}

			shipment["items"] = shipmentItems

			shipments = append(shipments, shipment)
		}

		warehouse["shipments"] = shipments
	}

	return map[string]any{
		"merchant":   merchant,
		"warehouses": warehouses,
	}, nil
}

// ----------------------------------
// GetWarehouseOutgoingTransfers
// ----------------------------------
func GetWarehouseOutgoingTransfers(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetWarehouseOutgoingTransfers triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid", "name"},
		fmt.Sprintf("guid = '%s'", strings.ReplaceAll(merchantID, "'", "''")),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	// Warehuses
	warehouses, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{"guid", "name", "address"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	shopFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if shopID != "" {
		shopFilter += fmt.Sprintf(
			" AND guid = '%s'",
			strings.ReplaceAll(shopID, "'", "''"),
		)
	}

	// Shops
	shops, err := utils.SelectItems(
		request,
		"shops",
		[]string{
			"guid",
			"name",
			"logo",
			"phone",
			"email",
			"address",
		},
		shopFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	warehouseIDs := utils.GetIDs(warehouses, "guid")

	movementFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	) + " AND " +
		utils.BuildInClause("warehouse_id", warehouseIDs) +
		" AND 'TRANSFER' = ANY(type)" +
		" AND warehouse_id IS NOT NULL"

	if shopID != "" {
		movementFilter += fmt.Sprintf(
			" AND shops_id_2 = '%s'",
			strings.ReplaceAll(shopID, "'", "''"),
		)
	}

	movements, err := utils.SelectItems(
		request,
		"stock_movements",
		[]string{
			"guid",
			"warehouse_id",
			"warehouse_id_2",
			"shops_id_2",
			"type",
			"status",
		},
		movementFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	movmentIDs := utils.GetIDs(movements, "guid")

	items, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
			"stock_movements_id",
			"product_variations_id",
			"quantity",
		},
		utils.BuildInClause("stock_movements_id", movmentIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationIDs := utils.GetIDs(items, "product_variations_id")

	variations, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
			"sku",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"size",
			"color",
		},
		utils.BuildInClause("guid", variationIDs),
		[]string{
			"guid",
			"products_id",
			"sku",
			"size",
			"color",
		},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(variations, "products_id")

	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"category_id",
		},
		utils.BuildInClause("guid", productIDs),
		[]string{
			"guid",
			"name",
			"category_id",
		},
	)
	if err != nil {
		return nil, err
	}

	warehouseByID := utils.GroupByID(warehouses, "guid")

	shopByID := utils.GroupByID(shops, "guid")

	variationByID := utils.GroupByID(variations, "guid")

	productByID := utils.GroupByID(products, "guid")

	movementsByWarehouse := utils.GroupBy(movements, "warehouse_id")
	itemsByMovement := utils.GroupBy(items, "stock_movements_id")

	for _, warehouse := range warehouses {

		wID := cast.ToString(warehouse["guid"])
		warehouseMovements := movementsByWarehouse[wID]
		transfers := make([]map[string]any, 0)

		for _, movement := range warehouseMovements {
			mID := cast.ToString(movement["guid"])
			destinationWarehouseID := cast.ToString(movement["warehouse_id_2"])
			destinationShopID := cast.ToString(movement["shops_id_2"])

			transferItems := make([]map[string]any, 0)
			for _, item := range itemsByMovement[mID] {
				variationID := cast.ToString(item["product_variations_id"])

				variation := variationByID[variationID]
				if variation == nil {
					continue
				}

				productID := cast.ToString(variation["products_id"])

				product := productByID[productID]
				if product == nil {
					continue
				}

				transferItems = append(transferItems, map[string]any{
					"guid":         item["guid"],
					"product_id":   product["guid"],
					"product_name": product["name"],
					"variation_id": variation["guid"],
					"sku":          variation["sku"],
					"size":         variation["size"],
					"color":        variation["color"],
					"quantity":     item["quantity"],
					"images":       variation["images"],
				})
			}

			transfer := map[string]any{
				"guid":                  mID,
				"type":                  movement["type"],
				"status":                movement["status"],
				"destination_warehouse": warehouseByID[destinationWarehouseID],
				"destination_shop":      shopByID[destinationShopID],
				"items":                 transferItems,
			}
			transfers = append(transfers, transfer)
		}

		warehouse["transfers"] = transfers
	}

	return map[string]any{
		"merchant":   merchant,
		"warehouses": warehouses,
	}, nil
}

// -------------------------
// GetShopSales
// ------------------------
func GetShopSales(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetShopSales triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid", "name"},
		fmt.Sprintf("guid = '%s'", strings.ReplaceAll(merchantID, "'", "''")),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	shopFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if shopID != "" {
		shopFilter += fmt.Sprintf(
			" AND guid = '%s'",
			strings.ReplaceAll(shopID, "'", "''"),
		)
	}

	// Shops
	shops, err := utils.SelectItems(
		request,
		"shops",
		[]string{
			"guid",
			"name",
			"logo",
			"phone",
			"email",
			"address",
		},
		shopFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	shopIDs := utils.GetIDs(shops, "guid")

	movementFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	movements, err := utils.SelectItems(
		request,
		"stock_movements",
		[]string{
			"guid",
			"shops_id",
			"type",
			"status",
		},
		movementFilter+
			" AND "+
			utils.BuildInClause("shops_id", shopIDs)+
			" AND 'SALE' = ANY(type)"+
			" AND shops_id IS NOT NULL",
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	movmentIDs := utils.GetIDs(movements, "guid")

	items, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
			"stock_movements_id",
			"product_variations_id",
			"quantity",
		},
		utils.BuildInClause("stock_movements_id", movmentIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationIDs := utils.GetIDs(items, "product_variations_id")

	variations, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
			"sku",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"size",
			"color",
		},
		utils.BuildInClause("guid", variationIDs),
		[]string{
			"guid",
			"products_id",
			"sku",
			"size",
			"color",
		},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(variations, "products_id")

	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"category_id",
		},
		utils.BuildInClause("guid", productIDs),
		[]string{
			"guid",
			"name",
			"category_id",
		},
	)
	if err != nil {
		return nil, err
	}

	variationByID := utils.GroupByID(variations, "guid")
	productByID := utils.GroupByID(products, "guid")

	salesByShop := utils.GroupBy(movements, "shops_id")
	itemsBySales := utils.GroupBy(items, "stock_movements_id")

	for _, shop := range shops {

		shopID := cast.ToString(shop["guid"])
		shopSales := salesByShop[shopID]

		sales := make([]map[string]any, 0)

		for _, movement := range shopSales {

			movementID := cast.ToString(movement["guid"])

			sale := map[string]any{
				"guid":   movement["guid"],
				"type":   movement["type"],
				"status": movement["status"],
			}

			saleItems := make([]map[string]any, 0)

			for _, item := range itemsBySales[movementID] {

				variationID := cast.ToString(item["product_variations_id"])

				variation := variationByID[variationID]
				if variation == nil {
					continue
				}

				productID := cast.ToString(variation["products_id"])

				product := productByID[productID]
				if product == nil {
					continue
				}

				saleItems = append(saleItems, map[string]any{
					"guid":         item["guid"],
					"product_id":   product["guid"],
					"product_name": product["name"],
					"variation_id": variation["guid"],
					"sku":          variation["sku"],
					"size":         variation["size"],
					"color":        variation["color"],
					"quantity":     item["quantity"],
					"images":       variation["images"],
				})
			}

			sale["items"] = saleItems
			sales = append(sales, sale)
		}

		shop["sales"] = sales
	}

	return map[string]any{
		"merchant": merchant,
		"shops":    shops,
	}, nil
}

// ------------------------
// GetShopTransfers
// ------------------------
func GetShopTransfers(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetShopTransfers triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid", "name"},
		fmt.Sprintf("guid = '%s'", strings.ReplaceAll(merchantID, "'", "''")),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	shopFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if shopID != "" {
		shopFilter += fmt.Sprintf(
			" AND guid = '%s'",
			strings.ReplaceAll(shopID, "'", "''"),
		)
	}

	// Shops
	shops, err := utils.SelectItems(
		request,
		"shops",
		[]string{
			"guid",
			"name",
			"logo",
			"phone",
			"email",
			"address",
		},
		shopFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	shopIDs := utils.GetIDs(shops, "guid")

	movementFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if shopID != "" {
		// Shop Manager:
		// own shop -> other shop
		// other shop -> own shop
		movementFilter += fmt.Sprintf(
			" AND (shops_id = '%s' OR shops_id_2 = '%s')",
			strings.ReplaceAll(shopID, "'", "''"),
			strings.ReplaceAll(shopID, "'", "''"),
		)
	} else {
		// Merchant:
		// all shops' outgoing transfers
		movementFilter += " AND " + utils.BuildInClause("shops_id", shopIDs)
	}

	movementFilter +=
		" AND 'TRANSFER' = ANY(type)" +
			" AND shops_id IS NOT NULL" +
			" AND shops_id_2 IS NOT NULL"

	movements, err := utils.SelectItems(
		request,
		"stock_movements",
		[]string{
			"guid",
			"shops_id",
			"shops_id_2",
			"type",
			"status",
		},
		movementFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	movmentIDs := utils.GetIDs(movements, "guid")

	items, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
			"stock_movements_id",
			"product_variations_id",
			"quantity",
		},
		utils.BuildInClause("stock_movements_id", movmentIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationIDs := utils.GetIDs(items, "product_variations_id")

	variations, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
			"sku",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"size",
			"color",
		},
		utils.BuildInClause("guid", variationIDs),
		[]string{
			"guid",
			"products_id",
			"sku",
			"size",
			"color",
		},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(variations, "products_id")

	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"category_id",
		},
		utils.BuildInClause("guid", productIDs),
		[]string{
			"guid",
			"name",
			"category_id",
		},
	)
	if err != nil {
		return nil, err
	}

	variationByID := utils.GroupByID(variations, "guid")
	productByID := utils.GroupByID(products, "guid")
	shopByID := utils.GroupByID(shops, "guid")

	transfersByShop := utils.GroupBy(movements, "shops_id")
	itemsByTransfer := utils.GroupBy(items, "stock_movements_id")

	for _, shop := range shops {
		shopID := cast.ToString(shop["guid"])
		shopTransfers := transfersByShop[shopID]
		transfers := make([]map[string]any, 0)

		for _, movement := range shopTransfers {
			mID := cast.ToString(movement["guid"])
			destinationShopID := cast.ToString(movement["shops_id_2"])

			transferItems := make([]map[string]any, 0)
			for _, item := range itemsByTransfer[mID] {
				variationID := cast.ToString(item["product_variations_id"])

				variation := variationByID[variationID]
				if variation == nil {
					continue
				}

				productID := cast.ToString(variation["products_id"])

				product := productByID[productID]
				if product == nil {
					continue
				}

				transferItems = append(transferItems, map[string]any{
					"guid":         item["guid"],
					"product_id":   product["guid"],
					"product_name": product["name"],
					"variation_id": variation["guid"],
					"sku":          variation["sku"],
					"size":         variation["size"],
					"color":        variation["color"],
					"quantity":     item["quantity"],
					"images":       variation["images"],
				})
			}

			transfer := map[string]any{
				"guid":             mID,
				"type":             movement["type"],
				"status":           movement["status"],
				"destination_shop": shopByID[destinationShopID],
				"items":            transferItems,
			}
			transfers = append(transfers, transfer)
		}

		shop["transfers"] = transfers
	}

	return map[string]any{
		"merchant": merchant,
		"shops":    shops,
	}, nil
}

// -------------------------
// GetShopReturns
// -------------------------
func GetShopReturns(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetShopReturns triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid", "name"},
		fmt.Sprintf("guid = '%s'", strings.ReplaceAll(merchantID, "'", "''")),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	// Warehuses
	warehouses, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{"guid", "name", "address"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	shopFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if shopID != "" {
		shopFilter += fmt.Sprintf(
			" AND guid = '%s'",
			strings.ReplaceAll(shopID, "'", "''"),
		)
	}

	// Shops
	shops, err := utils.SelectItems(
		request,
		"shops",
		[]string{
			"guid",
			"name",
			"logo",
			"phone",
			"email",
			"address",
		},
		shopFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	warehouseIDs := utils.GetIDs(warehouses, "guid")
	movementFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	) + " AND " +
		utils.BuildInClause("warehouse_id_2", warehouseIDs) +
		" AND 'RETURN' = ANY(type)" +
		" AND shops_id IS NOT NULL"

	if shopID != "" {
		movementFilter += fmt.Sprintf(
			" AND shops_id = '%s'",
			strings.ReplaceAll(shopID, "'", "''"),
		)
	}

	movements, err := utils.SelectItems(
		request,
		"stock_movements",
		[]string{
			"guid",
			"shops_id",
			"warehouse_id_2",
			"type",
			"status",
		},
		movementFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	movmentIDs := utils.GetIDs(movements, "guid")

	items, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
			"stock_movements_id",
			"product_variations_id",
			"quantity",
		},
		utils.BuildInClause("stock_movements_id", movmentIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationIDs := utils.GetIDs(items, "product_variations_id")

	variations, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
			"sku",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"size",
			"color",
		},
		utils.BuildInClause("guid", variationIDs),
		[]string{
			"guid",
			"products_id",
			"sku",
			"size",
			"color",
		},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(variations, "products_id")

	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL), '[]'::json) AS images",
			"category_id",
		},
		utils.BuildInClause("guid", productIDs),
		[]string{
			"guid",
			"name",
			"category_id",
		},
	)
	if err != nil {
		return nil, err
	}

	variationByID := utils.GroupByID(variations, "guid")
	productByID := utils.GroupByID(products, "guid")
	warehouseByID := utils.GroupByID(warehouses, "guid")

	returnsByShop := utils.GroupBy(movements, "shops_id")
	itemsByReturn := utils.GroupBy(items, "stock_movements_id")

	for _, shop := range shops {
		shopID := cast.ToString(shop["guid"])
		shopReturns := returnsByShop[shopID]

		returns := make([]map[string]any, 0)

		for _, movement := range shopReturns {
			mID := cast.ToString(movement["guid"])
			destinationWarehouseID := cast.ToString(movement["warehouse_id_2"])

			returnItems := make([]map[string]any, 0)
			for _, item := range itemsByReturn[mID] {
				variationID := cast.ToString(item["product_variations_id"])

				variation := variationByID[variationID]
				if variation == nil {
					continue
				}

				productID := cast.ToString(variation["products_id"])

				product := productByID[productID]
				if product == nil {
					continue
				}

				returnItems = append(returnItems, map[string]any{
					"guid":         item["guid"],
					"product_id":   product["guid"],
					"product_name": product["name"],
					"variation_id": variation["guid"],
					"sku":          variation["sku"],
					"size":         variation["size"],
					"color":        variation["color"],
					"quantity":     item["quantity"],
					"images":       variation["images"],
				})
			}

			returnItem := map[string]any{
				"guid":                  mID,
				"type":                  movement["type"],
				"status":                movement["status"],
				"destination_warehouse": warehouseByID[destinationWarehouseID],
				"items":                 returnItems,
			}
			returns = append(returns, returnItem)
		}

		shop["returns"] = returns
	}

	return map[string]any{
		"merchant": merchant,
		"shops":    shops,
	}, nil
}
