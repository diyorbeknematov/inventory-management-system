package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

// -----------------------
// CreateWarehouse
// -----------------------
func CreateWarehouse(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateWarehouse triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	name := cast.ToString(data["name"])
	merchantID := cast.ToString(data["merchants_id"])
	address := cast.ToString(data["address"])

	if name == "" {
		return nil, fmt.Errorf("warehouse name is required")
	}

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{"guid"},
		fmt.Sprintf("guid = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if merchant == nil {
		return nil, fmt.Errorf("merchant not found")
	}

	// Check duplicate warehouse name for this merchant
	filter := fmt.Sprintf(
		"name = '%s' AND merchants_id = '%s'",
		strings.ReplaceAll(name, "'", "''"),
		merchantID,
	)

	existing, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{"guid"},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("warehouse with this name already exists")
	}

	// Create warehouse
	guid := uuid.New().String()

	createData := map[string]any{
		"guid":         guid,
		"name":         name,
		"merchants_id": merchantID,
	}

	if address != "" {
		createData["address"] = address
	}

	resp, raw, err := request.UcodeSdk.Items("warehouse").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create warehouse")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message":  "warehouse created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

// Update warehouse
func UpdateWarehouse(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateWarehouse function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	warehouseID := cast.ToString(data["warehouse_id"])

	if warehouseID == "" {
		return nil, fmt.Errorf("warehouse_id is required")
	}

	// Get warehouse merchant
	warehouse, err := utils.SelectOneItem(
		request,
		"warehouse",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", warehouseID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if warehouse == nil {
		return nil, fmt.Errorf("warehouse not found")
	}

	merchantID := cast.ToString(warehouse["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": warehouseID,
	}

	// Update name
	name := cast.ToString(data["name"])

	if name != "" {
		updateData["name"] = name
	}

	// Update address
	address := cast.ToString(data["address"])

	if address != "" {
		updateData["address"] = address
	}

	resp, raw, err := request.UcodeSdk.
		Items("warehouse").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update warehouse")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "warehouse updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

// Delete
func DeleteWarehouse(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteWarehouse function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	warehouseID := cast.ToString(data["warehouse_id"])

	if warehouseID == "" {
		return nil, fmt.Errorf("warehouse_id is required")
	}

	warehouse, err := utils.SelectOneItem(
		request,
		"warehouse",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", warehouseID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if warehouse == nil {
		return nil, fmt.Errorf("warehouse not found")
	}

	merchantID := cast.ToString(warehouse["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	// Check warehouse stock
	existing, err := utils.SelectItems(
		request,
		"warehouse_stocks",
		[]string{"guid"},
		fmt.Sprintf("warehouse_id = '%s'", warehouseID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this warehouse cannot be deleted because it has stock",
		)
	}

	// Check stock movements
	existing, err = utils.SelectItems(
		request,
		"stock_movements",
		[]string{"guid"},
		fmt.Sprintf(
			"warehouse_id = '%s' OR warehouse_id_2 = '%s'",
			warehouseID,
			warehouseID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this warehouse cannot be deleted because it is linked to stock movements",
		)
	}

	// Delete warehouse
	resp, err := request.UcodeSdk.
		Items("warehouse").
		Delete().
		Single(warehouseID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete warehouse")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	return map[string]any{
		"message": "warehouse deleted successfully",
		"data":    resp.Data,
	}, nil
}
