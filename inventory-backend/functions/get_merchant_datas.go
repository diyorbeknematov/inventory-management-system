package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/spf13/cast"
)

// -------------------------------
// GetMerchantProducts
// -------------------------------
func GetMerchantProducts(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantProducts triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])

	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	search := cast.ToString(data["search"])

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid", "name"},
		fmt.Sprintf("guid = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	productFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if search != "" {
		escapedSearch := strings.ReplaceAll(search, "'", "''")

		productFilter += fmt.Sprintf(
			" AND name ILIKE '%%%s%%'",
			escapedSearch,
		)
	}

	// products and product variations
	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"COALESCE(json_agg(images) FILTER (WHERE images IS NOT NULL),'[]'::json) AS images",
			"category_id",
		},
		productFilter,
		[]string{
			"guid",
			"name",
			"category_id",
		},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(products, "guid")

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
		utils.BuildInClause("products_id", productIDs),
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

	variationsByProduct := utils.GroupBy(variations, "products_id")

	for _, p := range products {
		pID := cast.ToString(p["guid"])
		p["variations"] = variationsByProduct[pID]
	}

	productsByCategory := utils.GroupBy(products, "category_id")

	categories, err := utils.SelectItems(
		request,
		"category",
		[]string{
			"guid",
			"name",
			"description",
			"category_id",
		},
		fmt.Sprintf(
			"merchants_id = '%s'",
			strings.ReplaceAll(merchantID, "'", "''"),
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	subCategoriesByParent := utils.GroupBy(categories, "category_id")

	rootCategories := subCategoriesByParent[""]

	resultCategories := make([]map[string]any, 0, len(rootCategories))

	for _, category := range rootCategories {
		tree := utils.BuildCategoryTree(
			category,
			subCategoriesByParent,
			productsByCategory,
		)

		if tree != nil {
			resultCategories = append(resultCategories, tree)
		}
	}

	return map[string]any{
		"merchant":   merchant,
		"products":   products,
		"categories": resultCategories,
	}, nil
}

// -------------------------------
// GetMerchantWarehouses
// -------------------------------
func GetCategories(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetCategories triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	merchantID := cast.ToString(data["merchants_id"])

	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	search := cast.ToString(data["search"])

	categoryFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		categoryFilter += fmt.Sprintf(
			" AND name ILIKE '%%%s%%'",
			search,
		)
	}

	categories, err := utils.SelectItems(
		request,
		"category",
		[]string{
			"guid",
			"name",
			"description",
			"category_id",
		},
		categoryFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"categories": categories,
	}, nil
}

// -------------------------------
// GetMerchantWarehouses
// -------------------------------
func GetMerchantWarehouses(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantWarehouses triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	search := cast.ToString(data["search"])

	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
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

	warehouseFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		warehouseFilter += fmt.Sprintf(
			" AND name ILIKE '%%%s%%'",
			search,
		)
	}

	// Warehuses
	warehouses, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{"guid", "name", "address"},
		warehouseFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	warehouseIDs := utils.GetIDs(warehouses, "guid")

	// warehouse stocks
	stocks, err := utils.SelectItems(
		request,
		"warehouse_stocks",
		[]string{"guid", "warehouse_id", "product_variations_id", "quantity"},
		utils.BuildInClause("warehouse_id", warehouseIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationsIDs := utils.GetIDs(stocks, "product_variations_id")

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
		utils.BuildInClause("guid", variationsIDs),
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

	variationByID := make(map[string]map[string]any)

	for _, variation := range variations {
		variationID := cast.ToString(variation["guid"])
		variationByID[variationID] = variation
	}

	productByID := make(map[string]map[string]any)

	for _, product := range products {
		productID := cast.ToString(product["guid"])
		productByID[productID] = product
	}

	stocksByWarehouse := utils.GroupBy(stocks, "warehouse_id")

	for _, w := range warehouses {
		warehouseID := cast.ToString(w["guid"])

		warehouseStocks := stocksByWarehouse[warehouseID]
		stockResult := make([]map[string]any, 0)

		for _, stock := range warehouseStocks {
			variationID := cast.ToString(stock["product_variations_id"])

			variation := variationByID[variationID]
			if variation == nil {
				continue
			}

			productID := cast.ToString(variation["products_id"])

			product := productByID[productID]
			if product == nil {
				continue
			}

			stockResult = append(stockResult, map[string]any{
				"product_id":   product["guid"],
				"product_name": product["name"],

				"variation_id": variation["guid"],
				"sku":          variation["sku"],
				"size":         variation["size"],
				"color":        variation["color"],
				"images":       variation["images"],

				"quantity": stock["quantity"],
			})
		}

		w["stocks"] = stockResult
	}

	return map[string]any{
		"merchant":   merchant,
		"warehouses": warehouses,
	}, nil
}

// -------------------------------
// GetMerchantShops
// -------------------------------
func GetMerchantShops(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantShops triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])
	search := cast.ToString(data["search"])

	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
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
		shopFilter += fmt.Sprintf(" AND guid = '%s'", strings.ReplaceAll(shopID, "'", "''"))
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		shopFilter += fmt.Sprintf(
			" AND name ILIKE '%%%s%%'",
			search,
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

	// shops inventory
	inventories, err := utils.SelectItems(
		request,
		"shop_inventory",
		[]string{
			"guid",
			"shops_id",
			"product_variations_id",
			"quantity",
			"base_price",
			"discount_value",
			"discount_type",
			"final_price",
		},
		utils.BuildInClause("shops_id", shopIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationsIDs := utils.GetIDs(inventories, "product_variations_id")

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
		utils.BuildInClause("guid", variationsIDs),
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

	variationByID := make(map[string]map[string]any)

	for _, variation := range variations {
		variationID := cast.ToString(variation["guid"])
		variationByID[variationID] = variation
	}

	productByID := make(map[string]map[string]any)

	for _, product := range products {
		productID := cast.ToString(product["guid"])
		productByID[productID] = product
	}

	inventoriesByShop := utils.GroupBy(inventories, "shops_id")

	for _, sh := range shops {
		shID := cast.ToString(sh["guid"])

		shopInventories := inventoriesByShop[shID]
		inventoryResult := make([]map[string]any, 0)

		for _, inventory := range shopInventories {
			variationID := cast.ToString(inventory["product_variations_id"])

			variation := variationByID[variationID]
			if variation == nil {
				continue
			}

			productID := cast.ToString(variation["products_id"])

			product := productByID[productID]
			if product == nil {
				continue
			}

			inventoryResult = append(inventoryResult, map[string]any{
				"product_id":   product["guid"],
				"product_name": product["name"],

				"variation_id": variation["guid"],
				"sku":          variation["sku"],
				"size":         variation["size"],
				"color":        variation["color"],
				"images":       variation["images"],

				"quantity":       inventory["quantity"],
				"base_price":     inventory["base_price"],
				"discount_value": inventory["discount_value"],
				"discount_type":  inventory["discount_type"],
				"final_price":    inventory["final_price"],
			})
		}

		sh["stocks"] = inventoryResult
	}

	return map[string]any{
		"merchant": merchant,
		"shops":    shops,
	}, nil
}
