package helper

import (
	"errors"
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

// -------------------------------
// CreateStockMovement
// -------------------------------
func CreateStockMovement(request *models.FunctionRequest) (map[string]any, error) {

	request.Logger.Info().Msg("CreateStockMovement triggered")

	if strings.TrimSpace(request.AppId) == "" {
		return nil, errors.New("app_id is required")
	}

	request.UcodeSdk.Config().AppId = request.AppId

	data := request.Data
	if data == nil {
		return nil, errors.New("data is required")
	}

	merchantID := cast.ToString(data["merchants_id"])
	sourceShopID := cast.ToString(data["shops_id"])
	sourceWarehouseID := cast.ToString(data["warehouse_id"])
	destShopID := cast.ToString(data["shops_id_2"])
	destWarehouseID := cast.ToString(data["warehouse_id_2"])

	movementType := cast.ToString(utils.GetFirstString(data["type"]))
	rowItems := utils.GetAnySlice(data["items"])

	status := "DRAFT"

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	if movementType == "" {
		return nil, errors.New("movement_type is required")
	}

	err := utils.ValidateStockMovement(
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
			for _, rawItem := range rowItems {

				item, ok := rawItem.(map[string]any)
				if !ok {
					return nil, errors.New(
						"invalid stock movement item",
					)
				}

				variationID := cast.ToString(
					item["product_variations_id"],
				)

				exists, err := utils.CheckVariationInStock(
					request,
					variationID,
					source,
				)
				if err != nil {
					return nil, err
				}

				if !exists {
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
		"status":       []string{status},
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
		fmt.Sprintf("guid = '%s'", movementID),
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

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	// Existing values
	sourceShopID := cast.ToString(movement["shops_id"])
	destinationShopID := cast.ToString(movement["shops_id_2"])
	sourceWarehouseID := cast.ToString(movement["warehouse_id"])
	destinationWarehouseID := cast.ToString(movement["warehouse_id_2"])
	movementType := utils.GetFirstString(movement["type"])

	if _, ok := data["shops_id"]; ok {
		sourceShopID = cast.ToString(data["shops_id"])
	}

	if _, ok := data["shops_id_2"]; ok {
		destinationShopID = cast.ToString(data["shops_id_2"])
	}

	if _, ok := data["warehouse_id"]; ok {
		sourceWarehouseID = cast.ToString(data["warehouse_id"])
	}

	if _, ok := data["warehouse_id_2"]; ok {
		destinationWarehouseID = cast.ToString(data["warehouse_id_2"])
	}

	if _, ok := data["type"]; ok {
		movementType = utils.GetFirstString(data["type"])
	}

	// Validate movement
	if err := utils.ValidateStockMovement(
		sourceShopID,
		destinationShopID,
		sourceWarehouseID,
		destinationWarehouseID,
		movementType,
	); err != nil {
		return nil, err
	}

	// Check source shop belongs to the same merchant
	if sourceShopID != "" {
		shop, err := utils.SelectOneItem(
			request,
			"shops",
			[]string{
				"guid",
				"merchants_id",
			},
			fmt.Sprintf("guid = '%s'", sourceShopID),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if shop == nil {
			return nil, fmt.Errorf("source shop not found")
		}

		if cast.ToString(shop["merchants_id"]) != merchantID {
			return nil, fmt.Errorf(
				"source shop does not belong to this merchant",
			)
		}
	}

	// Check destination shop belongs to the same merchant
	if destinationShopID != "" {
		shop, err := utils.SelectOneItem(
			request,
			"shops",
			[]string{
				"guid",
				"merchants_id",
			},
			fmt.Sprintf("guid = '%s'", destinationShopID),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if shop == nil {
			return nil, fmt.Errorf("destination shop not found")
		}

		if cast.ToString(shop["merchants_id"]) != merchantID {
			return nil, fmt.Errorf(
				"destination shop does not belong to this merchant",
			)
		}
	}

	// Check source warehouse belongs to the same merchant
	if sourceWarehouseID != "" {
		warehouse, err := utils.SelectOneItem(
			request,
			"warehouses",
			[]string{
				"guid",
				"merchants_id",
			},
			fmt.Sprintf("guid = '%s'", sourceWarehouseID),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if warehouse == nil {
			return nil, fmt.Errorf("source warehouse not found")
		}

		if cast.ToString(warehouse["merchants_id"]) != merchantID {
			return nil, fmt.Errorf(
				"source warehouse does not belong to this merchant",
			)
		}
	}

	// Check destination warehouse belongs to the same merchant
	if destinationWarehouseID != "" {
		warehouse, err := utils.SelectOneItem(
			request,
			"warehouses",
			[]string{
				"guid",
				"merchants_id",
			},
			fmt.Sprintf("guid = '%s'", destinationWarehouseID),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if warehouse == nil {
			return nil, fmt.Errorf("destination warehouse not found")
		}

		if cast.ToString(warehouse["merchants_id"]) != merchantID {
			return nil, fmt.Errorf(
				"destination warehouse does not belong to this merchant",
			)
		}
	}

	// Update only movement fields
	updateData := map[string]any{
		"guid":           movementID,
		"shops_id":       sourceShopID,
		"shops_id_2":     destinationShopID,
		"warehouse_id":   sourceWarehouseID,
		"warehouse_id_2": destinationWarehouseID,
		"type":           []string{movementType},
	}

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

	// Get movement
	movement, err := utils.SelectOneItem(
		request,
		"stock_movements",
		[]string{
			"guid",
			"status",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", movementID),
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

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
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

	// Delete items
	deletedItems := make([]map[string]any, 0, len(items))

	for _, item := range items {

		itemID := cast.ToString(item["guid"])

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

			// Oldin o'chirilgan itemlarni qayta tiklash
			for _, deletedItem := range deletedItems {

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

		deletedItems = append(deletedItems, item)
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
		for _, deletedItem := range deletedItems {

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

	return map[string]any{
		"message": "stock movement deleted successfully",
		"data":    resp.Data,
	}, nil
}
