package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

// ------------------------------
// Create Warehouse Stock
// ------------------------------
func CreateWarehouseStock(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateWarehouseStock triggered")

	appID := request.AppId
	if appID == "" {
		return nil, fmt.Errorf("app-id is required")
	}

	request.UcodeSdk.Config().AppId = request.AppId

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	warehouseID := cast.ToString(data["warehouse_id"])
	variationID := cast.ToString(data["product_variations_id"])
	quantity := cast.ToInt(data["quantity"])

	if quantity < 0 {
		return nil, fmt.Errorf("stock quantity cannot be negative")
	}

	if warehouseID == "" {
		return nil, fmt.Errorf("warehouse id is required")
	}

	if variationID == "" {
		return nil, fmt.Errorf("product variation id is required")
	}

	existing, err := utils.SelectItems(
		request,
		"warehouse_stocks",
		[]string{"guid"},
		fmt.Sprintf(
			"warehouse_id = '%s' AND product_variations_id = '%s'",
			warehouseID,
			variationID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this product variation already exists in this warehouse stock",
		)
	}

	guid := uuid.New().String()
	resp, raw, err := request.UcodeSdk.Items("warehouse_stocks").
		Create(map[string]any{
			"guid":                  guid,
			"warehouse_id":          warehouseID,
			"product_variations_id": variationID,
			"quantity":              quantity,
		}).
		DisableFaas(true).
		Exec()
	if err != nil {
		request.Logger.Err(err).
			Interface("raw_response", raw).
			Msg("failed to create warehouse stock")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	request.Logger.Info().Msg(fmt.Sprintf("create warehouse stock response: %v", resp.Data.Data.Data))

	return map[string]any{
		"message": "warehouse stock created successfully",
		"guid":    guid,
	}, nil
}
