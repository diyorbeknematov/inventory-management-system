package helper

import (
	"errors"
	"fmt"
	"function/functions/redis"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

func GetStockMovementItems(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetStockMovementItems function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	movementID := cast.ToString(data["movement_id"])
	search := cast.ToString(data["search"])

	if movementID == "" {
		return nil, fmt.Errorf("movement_id is required")
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	movementID = strings.ReplaceAll(movementID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf(
		"movement_items:%s:%s",
		movementID,
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

	filter := fmt.Sprintf(
		"sm.guid = '%s'",
		movementID,
	)

	if access.RoleName != "Admin" {
		merchantID := strings.ReplaceAll(access.MerchantID, "'", "''")

		if merchantID == "" {
			return nil, fmt.Errorf("merchant access is not configured")
		}

		filter += fmt.Sprintf(
			" AND sm.merchants_id = '%s'",
			merchantID,
		)

		switch access.ScopeType {

		case "SHOP":
			scopeID := strings.ReplaceAll(access.ScopeID, "'", "''")

			filter += fmt.Sprintf(
				" AND (sm.shops_id = '%s' OR sm.shops_id_2 = '%s')",
				scopeID,
				scopeID,
			)
		}
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND p.name ILIKE '%%%s%%'",
			search,
		)
	}

	items, err := utils.SelectJoin(
		request,
		"stock_movement_items smi",
		[]string{
			"smi.guid",
			"smi.stock_movements_id",
			"smi.product_variations_id",
			"smi.quantity",

			"pv.guid AS variation_id",
			"pv.products_id",
			"pv.sku",
			"pv.images",
			"pv.size",
			"pv.color",

			"p.guid AS product_id",
			"p.name AS product_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "stock_movements sm",
				"condition": "sm.guid = smi.stock_movements_id",
			},
			{
				"type":      "LEFT",
				"table":     "product_variations pv",
				"condition": "pv.guid = smi.product_variations_id",
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

	return map[string]any{
		"items": items,
	}, nil
}

func CreateStockMovementItem(
	request *models.FunctionRequest,
) (map[string]any, error) {

	request.Logger.Info().
		Msg("CreateStockMovementItems function called")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	stockMovementID := cast.ToString(data["stock_movements_id"])

	if stockMovementID == "" {
		return nil, fmt.Errorf("stock_movement_id is required")
	}

	variationID := cast.ToString(
		data["product_variations_id"],
	)

	if variationID == "" {
		return nil, fmt.Errorf("product_variation_id is required")
	}

	quantity := cast.ToInt(
		data["quantity"],
	)

	if quantity <= 0 {
		return nil, fmt.Errorf("quantity must be greater than 0")
	}

	stockMovementID = strings.ReplaceAll(stockMovementID, "'", "''")

	variationID = strings.ReplaceAll(variationID, "'", "''")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Get movement + variation + product
	result, err := utils.SelectJoin(
		request,
		"product_variations pv",
		[]string{
			"pv.guid",
			"pv.products_id",
			"p.merchants_id AS variation_merchant_id",

			"sm.guid AS movement_id",
			"sm.merchants_id AS movement_merchant_id",
			"sm.status AS movement_status",
			"sm.shops_id",
			"sm.warehouse_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "products p",
				"condition": "p.guid = pv.products_id",
			},
			{
				"type":  "INNER",
				"table": "stock_movements sm",
				"condition": fmt.Sprintf(
					"sm.guid = '%s'",
					stockMovementID,
				),
			},
		},
		fmt.Sprintf(
			"pv.guid = '%s'",
			variationID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return nil, fmt.Errorf(
			"product variation or stock movement not found",
		)
	}

	movement := result[0]

	movementID := cast.ToString(movement["movement_id"])

	merchantID := cast.ToString(
		movement["movement_merchant_id"],
	)

	if merchantID == "" {
		return nil, fmt.Errorf(
			"stock movement merchant is missing",
		)
	}

	// Check merchant access
	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	status := utils.GetFirstString(
		movement["movement_status"],
	)

	if status == "" {
		return nil, fmt.Errorf(
			"status is required",
		)
	}

	if status != "DRAFT" {
		return nil, fmt.Errorf(
			"cannot add items to a non-draft stock movement",
		)
	}

	variationMerchantID := cast.ToString(
		movement["variation_merchant_id"],
	)

	if variationMerchantID != merchantID {
		return nil, fmt.Errorf(
			"product variation does not belong to movement merchant",
		)
	}

	// Get source location
	sourceShopID := cast.ToString(
		movement["shops_id"],
	)

	sourceWarehouseID := cast.ToString(
		movement["warehouse_id"],
	)

	source := utils.GetSourceLocation(
		sourceShopID,
		sourceWarehouseID,
	)

	// Check whether variation exists in source stock.
	// Quantity is NOT checked here.
	if source.Table != "" {

		sourceID := strings.ReplaceAll(
			source.ID,
			"'",
			"''",
		)

		stocks, err := utils.SelectItems(
			request,
			source.Table,
			[]string{
				"guid",
			},
			fmt.Sprintf(
				"%s = '%s' AND product_variations_id = '%s'",
				source.Field,
				sourceID,
				variationID,
			),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if len(stocks) == 0 {
			return nil, fmt.Errorf(
				"product variation %s is not available in source stock",
				variationID,
			)
		}
	}

	// Check duplicate variation in this movement
	existingItems, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
		},
		fmt.Sprintf(
			"stock_movements_id = '%s' AND product_variations_id = '%s'",
			stockMovementID,
			variationID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existingItems) > 0 {
		return nil, fmt.Errorf(
			"this product variation already exists in this stock movement",
		)
	}

	// Create movement item
	itemPayload := map[string]any{
		"guid":                  uuid.New().String(),
		"stock_movements_id":    stockMovementID,
		"product_variations_id": variationID,
		"quantity":              quantity,
	}

	_, resp, err := request.UcodeSdk.
		Items("stock_movement_items").
		Create(itemPayload).
		DisableFaas(true).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Interface("payload", itemPayload).
			Msg("Failed to create stock movement item")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	// ---------------- Cleara Cache ----------------------
	invalidateMovementItemsCache(request, movementID)

	return map[string]any{
		"message": "stock movement item created successfully",
		"guid":    itemPayload["guid"],
	}, nil
}

func DeleteStockMovementItem(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteStockMovementItem function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	itemID := cast.ToString(data["movement_item_id"])

	if itemID == "" {
		return nil, fmt.Errorf("movement_item_id is required")
	}

	itemID = strings.ReplaceAll(itemID, "'", "''")

	// Get item, movement status and merchant
	item, err := utils.SelectJoin(
		request,
		"stock_movement_items smi",
		[]string{
			"smi.guid",
			"smi.movements_id",
			"sm.status",
			"sm.merchants_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "stock_movements sm",
				"condition": "smi.stock_movements_id = sm.guid",
			},
		},
		fmt.Sprintf(
			"smi.guid = '%s'",
			itemID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(item) == 0 {
		return nil, fmt.Errorf("stock movement item not found")
	}

	movement := item[0]

	status := utils.GetFirstString(movement["status"])

	if status != "DRAFT" {
		return nil, fmt.Errorf(
			"stock movement item can only be deleted from a draft movement",
		)
	}

	merchantID := cast.ToString(movement["merchants_id"])
	movementID := cast.ToString(movement["movements_id"])

	if merchantID == "" {
		return nil, fmt.Errorf(
			"stock movement merchant is missing",
		)
	}

	// Check user access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	// Delete item
	resp, err := request.UcodeSdk.
		Items("stock_movement_items").
		Delete().
		Single(itemID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete stock movement item")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	// ---------------- Cleara Cache ----------------------
	invalidateMovementItemsCache(request, movementID)

	return map[string]any{
		"message": "stock movement item deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateMovementItemsCache(request *models.FunctionRequest, productID string) {
	pattern := fmt.Sprintf("movement_items:list:%s",
		productID,
	)

	if err := redis.DeleteWildCard(request, pattern); err != nil {
		request.Logger.Error().
			Err(err).
			Str("pattern", pattern).
			Msg("cache invalidation failed")
	}
}
