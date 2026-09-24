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

func GetStockMovements(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetStockMovements function triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	movementType := cast.ToString(data["movement_type"])
	status := cast.ToString(data["movement_status"])
	search := cast.ToString(data["search"])
	merchantID := cast.ToString(data["merchants_id"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if access.RoleName != "Admin" {
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf("merchant access is not configured")
		}
	}

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("movements:list:%s:%s",
		merchantID,
		request.Params.CacheClient.Hash(search),
	)

	var cached map[string]any

	err = redis.Get(request, cacheKey, &cached)
	if err == nil {
		return cached, nil // cache hit
	}

	if !errors.Is(err, redis.ErrCacheMiss) {
		request.Logger.Err(err).Msg("redis get failed")
	}

	// --------------------------------------------------------------

	filter := "1=1"

	if merchantID != "" {
		merchantID = strings.ReplaceAll(
			merchantID,
			"'",
			"''",
		)

		filter += fmt.Sprintf(
			" AND merchants_id = '%s'",
			merchantID,
		)
	}

	switch access.ScopeType {
	case "SHOP":
		scopeID := strings.ReplaceAll(
			access.ScopeID,
			"'",
			"''",
		)

		filter += fmt.Sprintf(
			" AND (shops_id = '%s' OR shops_id_2 = '%s')",
			scopeID,
			scopeID,
		)

	case "WAREHOUSE":
		scopeID := strings.ReplaceAll(
			access.ScopeID,
			"'",
			"''",
		)

		filter += fmt.Sprintf(
			" AND (warehouse_id = '%s' OR warehouse_id_2 = '%s')",
			scopeID,
			scopeID,
		)
	}

	if movementType != "" {
		movementType = strings.ReplaceAll(
			movementType,
			"'",
			"''",
		)

		filter += fmt.Sprintf(
			" AND '%s' = ANY(type)",
			movementType,
		)
	}

	if status != "" {
		status = strings.ReplaceAll(
			status,
			"'",
			"''",
		)

		filter += fmt.Sprintf(
			" AND '%s' = ANY(status)",
			status,
		)
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND guid ILIKE '%%%s%%'",
			search,
		)
	}
	request.Logger.Info().Msg("before SelectItems")
	movements, err := utils.SelectItems(
		request,
		"stock_movements",
		[]string{
			"guid",
			"merchants_id",
			"shops_id",
			"shops_id_2",
			"warehouse_id",
			"warehouse_id_2",
			"type",
			"status",
			"created_at",
		},
		filter,
		[]string{},
	)
	request.Logger.Info().Msg("after SelectItems")
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"movements": movements,
	}

	// ----------------------- Cache Set ----------------------
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

// Create Stock Movement
func CreateStockMovement(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateStockMovement triggered")

	data := request.Data
	if data == nil {
		return nil, errors.New("data is required")
	}

	sourceShopID := cast.ToString(data["shops_id"])
	sourceWarehouseID := cast.ToString(data["warehouse_id"])
	destShopID := cast.ToString(data["shops_id_2"])
	destWarehouseID := cast.ToString(data["warehouse_id_2"])

	movementType := cast.ToString(utils.GetFirstString(data["type"]))
	rowItems := utils.GetAnySlice(data["items"])

	if movementType == "" {
		return nil, errors.New("movement_type is required")
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	var merchantID string

	if access.RoleName == "Admin" {
		merchantID = cast.ToString(data["merchants_id"])

		if merchantID == "" {
			return nil, fmt.Errorf("merchants_id is required")
		}
	} else {
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf("merchant access is not configured")
		}
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	err = utils.ValidateStockMovement(
		sourceShopID,
		destShopID,
		sourceWarehouseID,
		destWarehouseID,
		movementType,
	)
	if err != nil {
		return nil, err
	}

	err = utils.CheckMovementOwnership(
		request,
		merchantID,
		movementType,
		sourceShopID,
		sourceWarehouseID,
		destShopID,
		destWarehouseID,
	)
	if err != nil {
		return nil, err
	}

	// Validate movement items
	if len(rowItems) > 0 {
		err = utils.ValidateStockMovementItems(rowItems)
		if err != nil {
			return nil, err
		}

		// Check whether variations exist in source stock.
		source := utils.GetSourceLocation(
			sourceShopID,
			sourceWarehouseID,
		)

		if source.Table != "" {
			variationIDs := make([]string, 0, len(rowItems))

			for _, rawItem := range rowItems {
				item, ok := rawItem.(map[string]any)
				if !ok {
					return nil, errors.New("invalid stock movement item")
				}

				variationIDs = append(
					variationIDs,
					cast.ToString(item["product_variations_id"]),
				)
			}

			stocks, err := utils.CheckVariationInStock(
				request,
				variationIDs,
				source,
			)
			if err != nil {
				return nil, err
			}

			stockMap := make(map[string]bool, len(stocks))

			for _, id := range stocks {
				stockMap[id] = true
			}

			for _, variationID := range variationIDs {
				if !stockMap[variationID] {
					return nil, fmt.Errorf(
						"product variation %s is not available in source stock",
						variationID,
					)
				}
			}
		}
	}

	movementID := uuid.New().String()

	movementPayload := map[string]any{
		"merchants_id": merchantID,
		"type":         []string{movementType},
		"status":       []string{"DRAFT"},
		"guid":         movementID,
	}

	switch movementType {

	case "RECEIPT":
		movementPayload["warehouse_id_2"] = destWarehouseID

	case "SALE":
		movementPayload["shops_id"] = sourceShopID

	case "RETURN":
		movementPayload["shops_id"] = sourceShopID
		movementPayload["warehouse_id_2"] = destWarehouseID

	case "TRANSFER":

		if sourceShopID != "" {
			movementPayload["shops_id"] = sourceShopID
		}

		if sourceWarehouseID != "" {
			movementPayload["warehouse_id"] = sourceWarehouseID
		}

		if destShopID != "" {
			movementPayload["shops_id_2"] = destShopID
		}

		if destWarehouseID != "" {
			movementPayload["warehouse_id_2"] = destWarehouseID
		}
	}

	movementResp, raw, err := request.UcodeSdk.
		Items("stock_movements").
		Create(movementPayload).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("raw_response", raw).
			Interface("payload", movementPayload).
			Msg("Failed to create stock movement")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	fmt.Println(
		"\n\n\n",
		"Movement create response:",
		fmt.Sprintf("%+v", movementResp.Data.Data.Data),
	)

	if len(rowItems) == 0 {
		return map[string]any{
			"message": "stock movement created successfully",
		}, nil
	}

	createdItemIDs := make([]string, 0, len(rowItems))

	for i, rawItem := range rowItems {

		item, ok := rawItem.(map[string]any)
		if !ok {
			// Rollback movement because it was already created.
			deleteErr := utils.DeleteItemsByIDs(
				request,
				"stock_movements",
				[]string{movementID},
			)

			if deleteErr != nil {
				request.Logger.Err(deleteErr).
					Str("movement_id", movementID).
					Msg("failed to rollback stock movement")
			}

			return nil, fmt.Errorf(
				"%d - invalid stock movement item",
				i,
			)
		}

		guid := uuid.New().String()

		itemPayload := map[string]any{
			"stock_movements_id":    movementID,
			"product_variations_id": cast.ToString(item["product_variations_id"]),
			"quantity":              item["quantity"],
			"guid":                  guid,
		}

		_, raw2, err := request.UcodeSdk.
			Items("stock_movement_items").
			Create(itemPayload).
			Exec()

		if err != nil {

			// Rollback previously created items.
			deleteErr := utils.DeleteItemsByIDs(
				request,
				"stock_movement_items",
				createdItemIDs,
			)

			if deleteErr != nil {
				request.Logger.Err(deleteErr).
					Msg("failed to rollback created movement items")
			}

			// Rollback movement.
			movementDeleteErr := utils.DeleteItemsByIDs(
				request,
				"stock_movements",
				[]string{movementID},
			)

			if movementDeleteErr != nil {
				request.Logger.Err(movementDeleteErr).
					Str("movement_id", movementID).
					Msg("failed to rollback stock movement")
			}

			request.Logger.Err(err).
				Interface("raw_response", raw2).
				Interface("payload", itemPayload).
				Int("item_index", i).
				Msg("Failed to create movement item")

			return nil, err
		}

		createdItemIDs = append(
			createdItemIDs,
			guid,
		)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateMovementsCache(request, merchantID)

	return map[string]any{
		"message": "stock movement created successfully",
	}, nil
}

func UpdateStockMovement(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateStockMovement function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	movementID := cast.ToString(data["stock_movement_id"])

	if movementID == "" {
		return nil, fmt.Errorf("stock_movement_id is required")
	}

	movementID = strings.ReplaceAll(movementID, "'", "''")

	// Get existing movement
	movement, err := utils.SelectOneItem(
		request,
		"stock_movements",
		[]string{
			"guid",
			"status",
			"merchants_id",
			"shops_id",
			"shops_id_2",
			"warehouse_id",
			"warehouse_id_2",
			"type",
		},
		fmt.Sprintf(
			"guid = '%s'",
			movementID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if movement == nil {
		return nil, fmt.Errorf("stock movement not found")
	}

	// Only DRAFT movement can be updated
	status := utils.GetFirstString(movement["status"])

	if status != "DRAFT" {
		return nil, fmt.Errorf(
			"only draft stock movements can be updated",
		)
	}

	// Check merchant access
	merchantID := cast.ToString(movement["merchants_id"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	// Existing values
	oldSourceShopID := movement["shops_id"]
	oldSourceWarehouseID := movement["warehouse_id"]

	sourceShopID := oldSourceShopID
	sourceWarehouseID := oldSourceWarehouseID

	destShopID := movement["shops_id_2"]
	destWarehouseID := movement["warehouse_id_2"]

	movementType := utils.GetFirstString(movement["type"])

	// Override with new values if provided
	if value, ok := data["shops_id"]; ok {
		sourceShopID = value
	}

	if value, ok := data["shops_id_2"]; ok {
		destShopID = value
	}

	if value, ok := data["warehouse_id"]; ok {
		sourceWarehouseID = value
	}

	if value, ok := data["warehouse_id_2"]; ok {
		destWarehouseID = value
	}

	if value, ok := data["type"]; ok {
		movementType = utils.GetFirstString(value)
	}

	// Check whether source location changed
	sourceChanged :=
		cast.ToString(oldSourceShopID) != cast.ToString(sourceShopID) ||
			cast.ToString(oldSourceWarehouseID) != cast.ToString(sourceWarehouseID)

	items := cast.ToSlice(data["items"])

	// Validate movement
	if err := utils.ValidateStockMovement(
		cast.ToString(sourceShopID),
		cast.ToString(destShopID),
		cast.ToString(sourceWarehouseID),
		cast.ToString(destWarehouseID),
		movementType,
	); err != nil {
		return nil, err
	}

	if err := utils.CheckMovementOwnership(
		request,
		merchantID,
		movementType,
		cast.ToString(sourceShopID),
		cast.ToString(sourceWarehouseID),
		cast.ToString(destShopID),
		cast.ToString(destWarehouseID),
	); err != nil {
		return nil, err
	}

	// Validate items when source location changes
	if sourceChanged && len(items) > 0 {
		if err := utils.ValidateStockMovementItems(items); err != nil {
			return nil, err
		}

		source := utils.GetSourceLocation(
			cast.ToString(sourceShopID),
			cast.ToString(sourceWarehouseID),
		)

		if source.Table != "" {
			variationIDs := make(
				[]string,
				0,
				len(items),
			)

			for _, rawItem := range items {
				item, ok := rawItem.(map[string]any)
				if !ok {
					return nil, errors.New(
						"invalid stock movement item",
					)
				}

				variationID := cast.ToString(
					item["product_variations_id"],
				)

				if variationID == "" {
					return nil, errors.New(
						"product_variations_id is required",
					)
				}

				variationIDs = append(
					variationIDs,
					variationID,
				)
			}

			stocks, err := utils.CheckVariationInStock(
				request,
				variationIDs,
				source,
			)
			if err != nil {
				return nil, err
			}

			stockMap := make(
				map[string]bool,
				len(stocks),
			)

			for _, id := range stocks {
				stockMap[id] = true
			}

			for _, variationID := range variationIDs {
				if !stockMap[variationID] {
					return nil, fmt.Errorf(
						"product variation %s is not available in source stock",
						variationID,
					)
				}
			}
		}
	}

	// Update movement
	updateData := map[string]any{
		"guid":           movementID,
		"shops_id":       sourceShopID,
		"shops_id_2":     destShopID,
		"warehouse_id":   sourceWarehouseID,
		"warehouse_id_2": destWarehouseID,
		"type":           []string{movementType},
	}

	fmt.Println("\n\nUPDATE DATA:", updateData)

	resp, raw, err := request.UcodeSdk.
		Items("stock_movements").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", raw).
			Msg("failed to update stock movement")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	if sourceChanged {
		// Get old movement items
		oldItems, err := utils.SelectItems(
			request,
			"stock_movement_items",
			[]string{
				"guid",
			},
			fmt.Sprintf(
				"stock_movements_id = '%s'",
				movementID,
			),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		// Delete old items
		itemIDs := utils.GetIDs(oldItems, "guid")

		if len(itemIDs) > 0 {
			err = utils.DeleteItemsByIDs(
				request,
				"stock_movement_items",
				itemIDs,
			)
			if err != nil {
				return nil, err
			}
		}

		// Create new items
		for _, rawItem := range items {
			item, ok := rawItem.(map[string]any)
			if !ok {
				return nil, errors.New(
					"invalid stock movement item",
				)
			}

			itemPayload := map[string]any{
				"guid":               uuid.New().String(),
				"stock_movements_id": movementID,
				"product_variations_id": cast.ToString(
					item["product_variations_id"],
				),
				"quantity": item["quantity"],
			}

			_, raw2, err := request.UcodeSdk.
				Items("stock_movement_items").
				Create(itemPayload).
				Exec()

			if err != nil {
				request.Logger.Err(err).
					Interface("raw_response", raw2).
					Interface("payload", itemPayload).
					Msg("failed to create movement item")

				return nil, utils.ExtractUcodeError(raw2, err)
			}
		}
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateMovementsCache(request, merchantID)

	return map[string]any{
		"message": "stock movement updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

func DeleteStockMovement(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteStockMovement function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	movementID := cast.ToString(data["stock_movement_id"])

	if movementID == "" {
		return nil, fmt.Errorf("stock_movement_id is required")
	}

	movementID = strings.ReplaceAll(movementID, "'", "''")

	// Get movement
	movement, err := utils.SelectOneItem(
		request,
		"stock_movements",
		[]string{
			"guid",
			"status",
			"merchants_id",
		},
		fmt.Sprintf(
			"guid = '%s'",
			movementID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if movement == nil {
		return nil, fmt.Errorf("stock movement not found")
	}

	status := utils.GetFirstString(movement["status"])

	if status != "DRAFT" {
		return nil, fmt.Errorf(
			"only draft stock movements can be deleted",
		)
	}

	merchantID := cast.ToString(movement["merchants_id"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	// Get movement items before deleting them
	items, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{
			"guid",
			"stock_movements_id",
			"product_variations_id",
			"quantity",
		},
		fmt.Sprintf(
			"stock_movements_id = '%s'",
			movementID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	// Collect item IDs
	itemIDs := utils.GetIDs(items, "guid")

	if len(itemIDs) > 0 {

		resp, err := request.UcodeSdk.
			Items("stock_movement_items").
			Delete().
			Multiple(itemIDs).
			Exec()

		if err != nil {
			request.Logger.
				Err(err).
				Interface("response", resp).
				Msg("failed to delete stock movement items")

			return nil, utils.ExtractUcodeError(resp, err)
		}
	}

	// Delete movement
	resp, err := request.UcodeSdk.
		Items("stock_movements").
		Delete().
		Single(movementID).
		Exec()

	if err != nil {

		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete stock movement")

		// Restore deleted items
		for _, deletedItem := range items {

			_, _, restoreErr := request.UcodeSdk.
				Items("stock_movement_items").
				Create(deletedItem).
				Exec()

			if restoreErr != nil {
				request.Logger.
					Err(restoreErr).
					Interface("item", deletedItem).
					Msg("failed to restore stock movement item")
			}
		}

		return nil, utils.ExtractUcodeError(resp, err)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateMovementsCache(request, merchantID)

	return map[string]any{
		"message": "stock movement deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateMovementsCache(request *models.FunctionRequest, merchantID string) {
	patterns := []string{
		fmt.Sprintf("movements:list:%s:*", merchantID), // shu merchant
		"movements:list::*",                            // Admin "hammasi" ro'yxati
	}

	for _, p := range patterns {
		if err := redis.DeleteWildCard(request, p); err != nil {
			request.Logger.Error().
				Err(err).
				Str("pattern", p).
				Msg("cache invalidation failed")
		}
	}
}
