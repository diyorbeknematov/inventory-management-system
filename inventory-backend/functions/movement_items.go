package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

func CreateStockMovementItem(
	request *models.FunctionRequest,
) (map[string]any, error) {

	request.Logger.Info().
		Msg("CreateStockMovementItems function called")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	stockMovementID := cast.ToString(
		data["stock_movements_id"],
	)

	if stockMovementID == "" {
		return nil, fmt.Errorf(
			"stock_movement_id is required",
		)
	}

	variationID := cast.ToString(
		data["product_variations_id"],
	)

	if variationID == "" {
		return nil, fmt.Errorf(
			"product_variation_id is required",
		)
	}

	quantity := cast.ToInt(
		data["quantity"],
	)

	if quantity <= 0 {
		return nil, fmt.Errorf(
			"quantity must be greater than 0",
		)
	}

	// Get stock movement.
	result, resp, err := request.UcodeSdk.
		Items("stock_movements").
		GetSingle(stockMovementID).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("Error fetching stock movement")

		return nil, fmt.Errorf(
			"error fetching stock movement: %w",
			err,
		)
	}

	if result.Data.Data.Response == nil {
		return nil, fmt.Errorf(
			"stock movement not found: %s",
			stockMovementID,
		)
	}

	stockMovement := result.Data.Data.Response

	merchantID := cast.ToString(
		stockMovement["merchants_id"],
	)

	if merchantID == "" {
		return nil, fmt.Errorf(
			"stock movement merchant is missing",
		)
	}

	status := utils.GetFirstString(
		stockMovement["status"],
	)

	if status == "" {
		return nil, fmt.Errorf(
			"status is required",
		)
	}

	// Only DRAFT movement can receive new items.
	if status != "DRAFT" {
		return nil, fmt.Errorf(
			"cannot add items to a non-draft stock movement",
		)
	}

	// Get source location.
	sourceShopID := cast.ToString(
		stockMovement["shops_id"],
	)

	sourceWarehouseID := cast.ToString(
		stockMovement["warehouse_id"],
	)

	source := utils.GetSourceLocation(
		sourceShopID,
		sourceWarehouseID,
	)

	// Check whether variation exists in source stock.
	// Quantity is NOT checked here.
	if source.Table != "" {

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

	// Check product variation exists.
	variation, err := utils.SelectOneItem(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
		},
		fmt.Sprintf(
			"guid = '%s'",
			variationID,
		),
		[]string{},
	)

	if err != nil {
		return nil, err
	}

	if variation == nil {
		return nil, fmt.Errorf(
			"product variation not found",
		)
	}

	// Check product belongs to the same merchant as the stock movement.
	productID := cast.ToString(
		variation["products_id"],
	)

	if productID == "" {
		return nil, fmt.Errorf(
			"product variation product is missing",
		)
	}

	product, err := utils.SelectOneItem(
		request,
		"products",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf(
			"guid = '%s'",
			productID,
		),
		[]string{},
	)

	if err != nil {
		return nil, err
	}

	if product == nil {
		return nil, fmt.Errorf(
			"product not found",
		)
	}

	productMerchantID := cast.ToString(
		product["merchants_id"],
	)

	if productMerchantID != merchantID {
		return nil, fmt.Errorf(
			"product variation does not belong to movement merchant",
		)
	}

	// Check duplicate variation in this movement.
	existingItems, err := utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{"guid"},
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

	// Create item.
	itemPayload := map[string]any{
		"guid":                  uuid.New().String(),
		"stock_movements_id":    stockMovementID,
		"product_variations_id": variationID,
		"quantity":              quantity,
	}

	_, resp, err = request.UcodeSdk.
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

	// Get item, movement status and merchant
	item, err := utils.SelectJoin(
		request,
		"stock_movement_items smi",
		[]string{
			"smi.guid",
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
		fmt.Sprintf("smi.guid = '%s'", itemID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(item) == 0 {
		return nil, fmt.Errorf("stock movement item not found")
	}

	status := utils.GetFirstString(item[0]["status"])

	if status != "DRAFT" {
		return nil, fmt.Errorf(
			"stock movement item can only be deleted from a draft movement",
		)
	}

	merchantID := cast.ToString(item[0]["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
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

	return map[string]any{
		"message": "stock movement item deleted successfully",
		"data":    resp.Data,
	}, nil
}
