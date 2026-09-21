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
// CreateShop
// -----------------------
func CreateShop(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateShop triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	name := cast.ToString(data["name"])
	merchantID := cast.ToString(data["merchants_id"])
	logo := cast.ToString(data["logo"])
	phone := cast.ToString(data["phone"])
	email := cast.ToString(data["email"])
	address := cast.ToString(data["address"])

	if name == "" {
		return nil, fmt.Errorf("shop name is required")
	}

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	// Merchant exists
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

	// Check duplicate shop name inside merchant
	filter := fmt.Sprintf(
		"name = '%s' AND merchants_id = '%s'",
		strings.ReplaceAll(name, "'", "''"),
		merchantID,
	)

	existing, err := utils.SelectItems(
		request,
		"shops",
		[]string{"guid"},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("shop with this name already exists")
	}

	guid := uuid.New().String()

	createData := map[string]any{
		"guid":         guid,
		"name":         name,
		"merchants_id": merchantID,
	}

	if logo != "" {
		createData["logo"] = logo
	}

	if phone != "" {
		createData["phone"] = phone
	}

	if email != "" {
		createData["email"] = email
	}

	if address != "" {
		createData["address"] = address
	}

	resp, raw, err := request.UcodeSdk.Items("shops").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create shop")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message":  "shop created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

func UpdateShop(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateShop function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	shopID := cast.ToString(data["shop_id"])

	if shopID == "" {
		return nil, fmt.Errorf("shop_id is required")
	}

	// Get shop merchant
	shop, err := utils.SelectOneItem(
		request,
		"shops",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", shopID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if shop == nil {
		return nil, fmt.Errorf("shop not found")
	}

	merchantID := cast.ToString(shop["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": shopID,
	}

	// Update name
	name := cast.ToString(data["name"])

	if name != "" {
		updateData["name"] = name
	}

	// Update logo
	logo := cast.ToString(data["logo"])

	if logo != "" {
		updateData["logo"] = logo
	}

	// Update phone
	phone := cast.ToString(data["phone"])

	if phone != "" {
		updateData["phone"] = phone
	}

	// Update email
	email := cast.ToString(data["email"])

	if email != "" {
		updateData["email"] = email
	}

	// Update address
	address := cast.ToString(data["address"])

	if address != "" {
		updateData["address"] = address
	}

	resp, raw, err := request.UcodeSdk.
		Items("shops").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update shop")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "shop updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

func DeleteShop(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteShop function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	shopID := cast.ToString(data["shop_id"])

	if shopID == "" {
		return nil, fmt.Errorf("shop_id is required")
	}

	shop, err := utils.SelectOneItem(
		request,
		"shops",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", shopID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if shop == nil {
		return nil, fmt.Errorf("shop not found")
	}

	merchantID := cast.ToString(shop["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	// Check shop inventory
	existing, err := utils.SelectItems(
		request,
		"shop_inventory",
		[]string{"guid"},
		fmt.Sprintf("shops_id = '%s'", shopID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this shop cannot be deleted because it has inventory",
		)
	}

	// Check stock movements
	existing, err = utils.SelectItems(
		request,
		"stock_movements",
		[]string{"guid"},
		fmt.Sprintf(
			"shops_id = '%s' OR shops_id_2 = '%s'",
			shopID,
			shopID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this shop cannot be deleted because it is linked to stock movements",
		)
	}

	// Delete shop
	resp, err := request.UcodeSdk.
		Items("shops").
		Delete().
		Single(shopID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete shop")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	return map[string]any{
		"message": "shop deleted successfully",
		"data":    resp.Data,
	}, nil
}
