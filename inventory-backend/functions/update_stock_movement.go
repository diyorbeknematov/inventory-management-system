package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"

	"github.com/spf13/cast"
)

// --------------------------
// UpdateStockMovement
// --------------------------
func UpdateMovementStatus(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateMovementStatus function called")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	stockMovementID := cast.ToString(data["guid"])
	sourceShopID := cast.ToString(data["shops_id"])
	destinationShopID := cast.ToString(data["shops_id_2"])
	sourceWarehouseID := cast.ToString(data["warehouse_id"])
	destinationWarehouseID := cast.ToString(data["warehouse_id_2"])
	status := utils.GetFirstString(data["status"])
	movementType := utils.GetFirstString(data["type"])

	if status == "" {
		return nil, fmt.Errorf("status is required")
	}

	if movementType == "" {
		return nil, fmt.Errorf("movement type is required")
	}

	// validate stock movementa
	err := utils.ValidateStockMovement(
		sourceShopID,
		destinationShopID,
		sourceWarehouseID,
		destinationWarehouseID,
		movementType,
	)
	if err != nil {
		return nil, fmt.Errorf("invalid stock movement: %w", err)
	}

	// update stock movement if status is SENT
	if status != "SENT" {
		return map[string]any{
			"message": "Stock movement updated successfully",
		}, nil
	}

	// Movement itemsni bir marta olamiz
	stocks, err := utils.GetStockChanges(
		request,
		stockMovementID,
	)
	if err != nil {
		_ = setStockMovementStatus(
			request,
			stockMovementID,
			"REJECTED",
		)

		return nil, err
	}

	// Variationlar mavjudligini tekshiramiz
	err = validateMovementVariations(
		request,
		stocks,
	)
	if err != nil {
		_ = setStockMovementStatus(
			request,
			stockMovementID,
			"REJECTED",
		)

		return nil, err
	}

	source := utils.GetSourceLocation(
		sourceShopID,
		sourceWarehouseID,
	)

	destination := utils.GetDestinationLocation(
		destinationShopID,
		destinationWarehouseID,
	)

	err = processStockMovement(
		request,
		movementType,
		source,
		destination,
		stocks,
	)
	if err != nil {
		if statusErr := setStockMovementStatus(
			request,
			stockMovementID,
			"REJECTED",
		); statusErr != nil {
			request.Logger.Err(statusErr).
				Msg("failed to set movement status to REJECTED")
		}

		return nil, err
	}

	// 4. Hammasi muvaffaqiyatli bo'lsa -> ACCEPTED
	err = setStockMovementStatus(
		request,
		stockMovementID,
		"ACCEPTED",
	)
	if err != nil {
		request.Logger.Err(err).
			Str("stock_movement_id", stockMovementID).
			Msg("CRITICAL: stock movement completed but failed to set ACCEPTED status")

		return nil, fmt.Errorf(
			"stock movement completed, but failed to set status to ACCEPTED: %w",
			err,
		)
	}

	// ---------------- Cleara Cache ----------------------
	invalidateMovementItemsCache(request, stockMovementID)

	return map[string]any{
		"message":       "Stock movement updated successfully",
		"movement type": movementType,
	}, nil
}

// Check stock
func checkAvailableStock(
	request *models.FunctionRequest,
	sourceID string,
	tableSlug string,
	fieldSlug string,
	stocks []utils.StockChange,
) ([]utils.StockChange, error) {
	request.Logger.Info().Msg("checkAvailableStock function called")

	variationIDs := make([]string, 0, len(stocks))

	for _, stock := range stocks {
		variationIDs = append(
			variationIDs,
			stock.VariationID,
		)
	}

	sourceStocks, resp, err := request.UcodeSdk.Items(tableSlug).
		GetList().
		Page(1).
		Limit(1000).
		Filter(map[string]any{
			fieldSlug: sourceID,
			"product_variations_id": map[string]any{
				"$in": variationIDs,
			},
		}).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("error while fetching source stock")

		return nil, fmt.Errorf(
			"error while fetching source stock: %w",
			err,
		)
	}

	stockMap := make(map[string]utils.StockChange)

	for _, sourceStock := range sourceStocks.Data.Data.Response {
		variationID := cast.ToString(
			sourceStock["product_variations_id"],
		)

		stockMap[variationID] = utils.StockChange{
			Guid:        cast.ToString(sourceStock["guid"]),
			VariationID: variationID,
			OldQuantity: cast.ToInt(sourceStock["quantity"]),
		}
	}

	for i := range stocks {
		stock, exists := stockMap[stocks[i].VariationID]

		if !exists {
			return nil, fmt.Errorf(
				"stock not found for product variation ID: %s",
				stocks[i].VariationID,
			)
		}

		if stock.OldQuantity < stocks[i].RequiredQuantity {
			return nil, fmt.Errorf(
				"insufficient stock for product: %s",
				stocks[i].ProductName,
			)
		}

		stocks[i].Guid = stock.Guid
		stocks[i].OldQuantity = stock.OldQuantity
	}

	return stocks, nil
}

// ------------------------
// set stock status
// ------------------------
func setStockMovementStatus(
	request *models.FunctionRequest,
	stockMovementID string,
	status string,
) error {
	request.Logger.Info().Msg("setStockMovementStatus function called")

	_, resp, err := request.UcodeSdk.Items("stock_movements").
		Update(map[string]any{
			"guid": stockMovementID,
			"status": []string{
				status,
			},
		}).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("error while setting stock movement status")

		return fmt.Errorf(
			"error while setting stock movement status: %w",
			err,
		)
	}

	return nil
}

// -------------------------
// Process Stock Movement
// -------------------------
func processStockMovement(
	request *models.FunctionRequest,
	movementType string,
	source utils.StockLocation,
	destination utils.StockLocation,
	stocks []utils.StockChange,
) error {

	switch movementType {
	case "RECEIPT":
		return processReceipt(
			request,
			destination,
			stocks,
		)

	case "SALE":
		return processSale(
			request,
			source,
			stocks,
		)

	case "RETURN", "TRANSFER":
		return processTransfer(
			request,
			source,
			destination,
			stocks,
		)

	default:
		return fmt.Errorf("invalid movement type: %s", movementType)
	}
}

// --------------------------
// Receipt
// -------------------------
func processReceipt(
	request *models.FunctionRequest,
	destination utils.StockLocation,
	stocks []utils.StockChange,
) error {

	err := utils.IncreaseStock(
		request,
		destination.ID,
		destination.Table,
		destination.Field,
		stocks,
	)
	if err != nil {
		return fmt.Errorf(
			"failed to increase destination stock: %w",
			err,
		)
	}

	return nil
}

// ------------------------
// Sale
// ------------------------
func processSale(
	request *models.FunctionRequest,
	source utils.StockLocation,
	stocks []utils.StockChange,
) error {

	stocks, err := checkAvailableStock(
		request,
		source.ID,
		source.Table,
		source.Field,
		stocks,
	)
	if err != nil {
		return err
	}

	err = utils.DecreaseStock(
		request,
		source.Table,
		stocks,
	)
	if err != nil {
		return fmt.Errorf(
			"failed to decrease source stock: %w",
			err,
		)
	}

	return nil
}

// -------------------------
// Transfer and Return
// -------------------------
func processTransfer(
	request *models.FunctionRequest,
	source utils.StockLocation,
	destination utils.StockLocation,
	stocks []utils.StockChange,
) error {

	stocks, err := checkAvailableStock(
		request,
		source.ID,
		source.Table,
		source.Field,
		stocks,
	)
	if err != nil {
		return err
	}

	// 1. Source kamayadi
	err = utils.DecreaseStock(
		request,
		source.Table,
		stocks,
	)
	if err != nil {
		return fmt.Errorf(
			"failed to decrease source stock: %w",
			err,
		)
	}

	// 2. Destination oshadi
	err = utils.IncreaseStock(
		request,
		destination.ID,
		destination.Table,
		destination.Field,
		stocks,
	)
	if err != nil {

		// Destination muvaffaqiyatsiz
		// Source'ni eski holatiga qaytarish
		rollbackErr := restoreStock(
			request,
			source.Table,
			stocks,
		)

		if rollbackErr != nil {
			request.Logger.Err(rollbackErr).
				Msg("CRITICAL: failed to rollback source stock")
		}

		return fmt.Errorf(
			"failed to increase destination stock: %w",
			err,
		)
	}

	return nil
}

// ----------------------------
// validateMovementVariations
// ----------------------------
func validateMovementVariations(
	request *models.FunctionRequest,
	stocks []utils.StockChange,
) error {
	request.Logger.Info().Msg("validateMovementVariations function called")

	if len(stocks) == 0 {
		return fmt.Errorf("there are no movement items")
	}

	variationIDs := make([]string, 0, len(stocks))

	for _, stock := range stocks {
		if stock.VariationID == "" {
			return fmt.Errorf("product variation ID is required")
		}

		variationIDs = append(variationIDs, stock.VariationID)
	}

	variations, resp, err := request.UcodeSdk.
		Items("product_variations").
		GetList().
		Page(1).
		Limit(1000).
		Filter(map[string]any{
			"guid": map[string]any{
				"$in": variationIDs,
			},
		}).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("failed to get product variations")

		return fmt.Errorf(
			"failed to get product variations: %w",
			err,
		)
	}

	if len(variations.Data.Data.Response) != len(variationIDs) {
		return fmt.Errorf(
			"one or more product variations do not exist",
		)
	}

	return nil
}

// -----------------------
// restoreStock
// -----------------------
func restoreStock(
	request *models.FunctionRequest,
	tableSlug string,
	stocks []utils.StockChange,
) error {

	request.Logger.Info().Msg("restoreStock function called")

	updateData := make([]map[string]any, 0, len(stocks))

	for _, stock := range stocks {
		updateData = append(updateData, map[string]any{
			"guid":     stock.Guid,
			"quantity": stock.OldQuantity,
		})
	}

	if len(updateData) == 0 {
		return nil
	}

	_, resp, err := request.UcodeSdk.
		Items(tableSlug).
		Update(map[string]any{
			"objects": updateData,
		}).
		DisableFaas(true).
		ExecMultiple()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("failed to restore stock")

		return fmt.Errorf(
			"failed to restore stock: %w",
			err,
		)
	}

	return nil
}
