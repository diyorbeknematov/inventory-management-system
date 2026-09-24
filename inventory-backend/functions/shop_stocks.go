package helper

import (
	"errors"
	"fmt"
	"function/functions/redis"
	"function/functions/utils"
	"function/models"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

func GetShopStocks(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetShopStocks function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	shopID := cast.ToString(data["shop_id"])
	search := cast.ToString(data["search"])

	if shopID == "" {
		return nil, fmt.Errorf("shop id is required")
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	shopID = strings.ReplaceAll(shopID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf(
		"shop_stocks:%s:%s",
		shopID,
		request.Params.CacheClient.Hash(search),
	)
	var cached map[string]any
	err = redis.Get(request, cacheKey, &cached)
	if err == nil {
		return cached, nil
	}

	if !errors.Is(err, redis.ErrCacheMiss) {
		request.Logger.
			Err(err).
			Msg("redis get failed")
	}

	// --------------------------------------------------------------

	if access.ScopeType == "SHOP" {
		if access.ScopeID != shopID {
			return nil, fmt.Errorf("you do not have permission to access this data")
		}

		shopID = access.ScopeID
	}

	filter := fmt.Sprintf(
		"si.shops_id = '%s'",
		shopID,
	)

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND p.name ILIKE '%%%s%%'",
			search,
		)
	}

	stockData, err := utils.SelectJoin(
		request,
		"shop_inventory si",
		[]string{
			"si.guid",
			"si.product_variations_id",
			"si.quantity",
			"si.base_price",
			"si.discount_value",
			"si.discount_type",
			"si.final_price",

			"pv.guid AS variation_id",
			"pv.products_id",
			"pv.sku",
			"pv.images AS variation_images",
			"pv.size",
			"pv.color",

			"p.guid AS product_id",
			"p.name AS product_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "shops s",
				"condition": "s.guid = si.shops_id",
			},
			{
				"type":      "LEFT",
				"table":     "product_variations pv",
				"condition": "pv.guid = si.product_variations_id",
			},
			{
				"type":      "LEFT",
				"table":     "products p",
				"condition": "p.guid = pv.products_id",
			},
		},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	stocks := make([]map[string]any, 0, len(stockData))

	for _, row := range stockData {
		stocks = append(stocks, map[string]any{
			"guid":                  row["guid"],
			"product_variations_id": row["product_variations_id"],
			"quantity":              row["quantity"],
			"base_price":            row["base_price"],
			"discount_value":        row["discount_value"],
			"discount_type":         row["discount_type"],
			"final_price":           row["final_price"],

			"variation_id":     row["variation_id"],
			"products_id":      row["products_id"],
			"sku":              row["sku"],
			"variation_images": row["variation_images"],
			"size":             row["size"],
			"color":            row["color"],

			"product_id":   row["product_id"],
			"product_name": row["product_name"],
		})
	}

	res := map[string]any{
		"stocks": stocks,
	}

	// ---------------- Cache Set ------------------------
	if err := redis.Set(
		request,
		cacheKey,
		res,
		redis.WithJitter(5*time.Minute),
	); err != nil {
		request.Logger.
			Err(err).
			Interface("data", res).
			Msg("redis set failed")
	}

	return res, nil
}

// -----------------------
// CreateShopInventory
// -----------------------
func CreateShopInventory(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateShopInventory triggered")

	appID := request.AppId
	if appID == "" {
		return nil, fmt.Errorf("app-id is required")
	}

	request.UcodeSdk.Config().AppId = request.AppId

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	shopID := cast.ToString(data["shops_id"])
	variationID := cast.ToString(data["product_variations_id"])
	quantity := cast.ToInt(data["quantity"])
	basePrice := cast.ToFloat64(data["base_price"])
	discountValue := cast.ToFloat64(data["discount_value"])
	discountType := cast.ToString(utils.GetFirstString(data["discount_type"]))
	finalPrice := cast.ToFloat64(data["final_price"])

	if shopID == "" {
		return nil, fmt.Errorf("shops_id is required")
	}

	if variationID == "" {
		return nil, fmt.Errorf("product_variations_id is required")
	}

	if quantity < 0 {
		return nil, fmt.Errorf("quantity cannot be negative")
	}

	if basePrice <= 0 {
		return nil, fmt.Errorf("base_price must be greater thatn 0")
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	shopID = strings.ReplaceAll(shopID, "'", "''")
	variationID = strings.ReplaceAll(variationID, "'", "''")

	// Get shop merchant
	shop, err := utils.SelectOneItem(
		request,
		"shops",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf(
			"guid = '%s'",
			shopID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if shop == nil {
		return nil, fmt.Errorf("shop not found")
	}

	merchantID := cast.ToString(shop["merchants_id"])

	switch access.RoleName {
	case "Admin", "Merchant":
		if err := utils.CanManage(access, merchantID); err != nil {
			return nil, err
		}
	case "Shop Manager":
		if access.MerchantID != merchantID {
			return nil, fmt.Errorf("you do not have permission to access this data")
		}

		if access.ScopeType != "SHOP" || access.ScopeID != shopID {
			return nil, fmt.Errorf("you do not have permission to access this shop")
		}
	default:
		return nil, fmt.Errorf("permission denied")
	}

	existing, err := utils.SelectItems(
		request,
		"shop_inventory",
		[]string{"guid"},
		fmt.Sprintf(
			"shops_id = '%s' AND product_variations_id = '%s'",
			shopID,
			variationID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this product variation already exists in this shop inventory",
		)
	}

	guid := uuid.New().String()

	updateData := map[string]any{
		"guid":                  guid,
		"shops_id":              shopID,
		"product_variations_id": variationID,
		"quantity":              quantity,
		"base_price":            basePrice,
	}

	switch discountType {
	case "PERCENTAGE":
		if discountValue < 0 || discountValue > 100 {
			return nil, fmt.Errorf(
				"discount value must be between 0 and 100 for percentage discount",
			)
		}

		updateData["discount_type"] = []string{"PERCENTAGE"}
		updateData["discount_value"] = discountValue

		finalPrice = basePrice - (basePrice / 100.0 * discountValue)

	case "FIXED":
		if discountValue < 0 {
			return nil, fmt.Errorf("discount value cannot be negative")
		}

		if discountValue > basePrice {
			return nil, fmt.Errorf(
				"discount value cannot be greater than base price",
			)
		}

		updateData["discount_type"] = []string{"FIXED"}
		updateData["discount_value"] = discountValue

		finalPrice = basePrice - discountValue

	default:
		updateData["discount_type"] = []string{"NONE"}
		updateData["discount_value"] = 0

		finalPrice = basePrice
	}

	updateData["final_price"] = finalPrice

	_, raw, err := request.UcodeSdk.
		Items("shop_inventory").
		Create(updateData).
		DisableFaas(true).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("raw_response", raw).
			Interface("payload", updateData).
			Msg("failed to create shop inventory")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ---------------- Cleara Cache ----------------------
	invalidateShopStocksCache(request, shopID)

	return map[string]any{
		"message":     "shop inventory created successfully",
		"guid":        guid,
		"final_price": finalPrice,
	}, nil
}

// -------------------------
// UpdateShopInventoryPrice
// -------------------------
func UpdateShopInventoryPrice(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateShopInventoryPrice triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	guid := cast.ToString(data["guid"])

	if guid == "" {
		return nil, fmt.Errorf("guid is required")
	}

	basePrice := cast.ToFloat64(data["base_price"])
	discountValue := cast.ToFloat64(data["discount_value"])
	discountType := utils.GetFirstString(data["discount_type"])

	guid = strings.ReplaceAll(guid, "'", "''")

	// Get inventory and merchant
	inventory, err := utils.SelectJoin(
		request,
		"shop_inventory si",
		[]string{
			"si.guid",
			"si.shops_id",
			"s.merchants_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "shops s",
				"condition": "si.shops_id = s.guid",
			},
		},
		fmt.Sprintf("si.guid = '%s'", guid),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(inventory) == 0 {
		return nil, fmt.Errorf("shop inventory not found")
	}

	merchantID := cast.ToString(inventory[0]["merchants_id"])
	shopID := cast.ToString(inventory[0]["shops_id"])

	// Check access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	// Base price must be greater than zero
	if basePrice <= 0 {
		return nil, fmt.Errorf("base price must be greater than 0")
	}

	updateData := map[string]any{
		"guid":       guid,
		"base_price": basePrice,
	}

	var finalPrice float64

	switch discountType {

	case "NONE":
		discountValue = 0
		finalPrice = basePrice

		updateData["discount_type"] = []string{"NONE"}
		updateData["discount_value"] = 0

	case "FIXED":
		if discountValue < 0 {
			return nil, fmt.Errorf(
				"discount value cannot be negative for fixed discount",
			)
		}

		if discountValue > basePrice {
			return nil, fmt.Errorf(
				"discount value cannot be greater than base price",
			)
		}

		finalPrice = basePrice - discountValue

		updateData["discount_type"] = []string{"FIXED"}
		updateData["discount_value"] = discountValue

	case "PERCENTAGE":
		if discountValue < 0 || discountValue > 100 {
			return nil, fmt.Errorf(
				"discount value must be between 0 and 100 for percentage discount",
			)
		}

		finalPrice = basePrice * (1 - discountValue/100)

		updateData["discount_type"] = []string{"PERCENTAGE"}
		updateData["discount_value"] = discountValue

	default:
		return nil, fmt.Errorf(
			"invalid discount type: %s",
			discountType,
		)
	}

	updateData["final_price"] = finalPrice

	resp, raw, err := request.UcodeSdk.
		Items("shop_inventory").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("raw_response", raw).
			Interface("payload", updateData).
			Msg("failed to update shop inventory price")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ---------------- Cleara Cache ----------------------
	invalidateShopStocksCache(request, shopID)

	return map[string]any{
		"message":     "shop inventory price updated successfully",
		"data":        resp.Data.Data,
		"guid":        guid,
		"final_price": finalPrice,
	}, nil
}

func invalidateShopStocksCache(request *models.FunctionRequest, productID string) {
	pattern := fmt.Sprintf("shop_stocks:list:%s",
		productID,
	)

	if err := redis.DeleteWildCard(request, pattern); err != nil {
		request.Logger.Error().
			Err(err).
			Str("pattern", pattern).
			Msg("cache invalidation failed")
	}
}
