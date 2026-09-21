package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

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

	resp, raw, err := request.UcodeSdk.Items("shop_inventory").
		Create(updateData).
		DisableFaas(true).
		Exec()
	if err != nil {
		request.Logger.Err(err).
			Interface("raw_response", raw).
			Interface("payload", updateData).
			Msg("failed to create shop inventory")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	request.Logger.Info().Msg(fmt.Sprintf("create inventory response: %v", resp.Data.Data.Data))

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

	// Get inventory and merchant
	inventory, err := utils.SelectJoin(
		request,
		"shop_inventory si",
		[]string{
			"si.guid",
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

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
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

	return map[string]any{
		"message":     "shop inventory price updated successfully",
		"data":        resp.Data.Data,
		"guid":        guid,
		"final_price": finalPrice,
	}, nil
}
