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
// CreateProductVariation
// -----------------------
func CreateProductVariation(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateProductVariation triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	productID := cast.ToString(data["products_id"])
	size := cast.ToString(data["size"])
	color := cast.ToString(data["color"])
	images := utils.GetStringSlice(data["images"])

	if productID == "" {
		return nil, fmt.Errorf("products_id is required")
	}

	// Product exists
	product, err := utils.SelectOneItem(
		request,
		"products",
		[]string{"guid", "code"},
		fmt.Sprintf("guid = '%s'", productID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if product == nil {
		return nil, fmt.Errorf("product not found")
	}

	productCode := cast.ToString(product["code"])
	sku := utils.GenerateSKU(productCode, color, size)
	// SKU unique
	existing, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{"guid"},
		fmt.Sprintf(
			"sku = '%s'",
			strings.ReplaceAll(sku, "'", "''"),
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("sku already exists")
	}

	variationID := uuid.New().String()

	createData := map[string]any{
		"guid":        variationID,
		"products_id": productID,
		"sku":         sku,
	}

	if size != "" {
		createData["size"] = size
	}

	if color != "" {
		createData["color"] = color
	}

	if len(images) > 0 {
		createData["images"] = images
	}

	resp, raw, err := request.UcodeSdk.Items("product_variations").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create product variation")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message":  "product variation created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

// Update
func UpdateProductVariation(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateProductVariation function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	variationID := cast.ToString(data["variation_id"])

	if variationID == "" {
		return nil, fmt.Errorf("variation_id is required")
	}

	// Get variation and product merchant
	variation, err := utils.SelectJoin(
		request,
		"product_variations pv",
		[]string{
			"pv.guid",
			"p.merchants_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "products p",
				"condition": "pv.products_id = p.guid",
			},
		},
		fmt.Sprintf("pv.guid = '%s'", variationID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(variation) == 0 {
		return nil, fmt.Errorf("variation not found")
	}

	merchantID := cast.ToString(variation[0]["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": variationID,
	}

	// Update size
	size := cast.ToString(data["size"])

	if size != "" {
		updateData["size"] = size
	}

	// Update color
	color := cast.ToString(data["color"])

	if color != "" {
		updateData["color"] = color
	}

	// Update images
	if images, ok := data["images"].([]any); ok {
		imageURLs := make([]string, 0, len(images))

		for _, image := range images {
			if imageURL, ok := image.(string); ok {
				imageURLs = append(imageURLs, imageURL)
			}
		}

		updateData["images"] = imageURLs
	}

	resp, raw, err := request.UcodeSdk.
		Items("product_variations").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update product variation")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "product variation updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

// Delete

func DeleteProductVariation(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteProductVariation function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	variationID := cast.ToString(data["variation_id"])

	if variationID == "" {
		return nil, fmt.Errorf("product variation_id is required")
	}

	variation, err := utils.SelectJoin(
		request,
		"product_variations pv",
		[]string{
			"pv.guid",
			"p.merchants_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "products p",
				"condition": "pv.products_id = p.guid",
			},
		},
		fmt.Sprintf("pv.guid = '%s'", variationID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(variation) == 0 {
		return nil, fmt.Errorf("variation not found")
	}

	merchantID := cast.ToString(variation[0]["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	// Check warehouse stock
	existing, err := utils.SelectItems(
		request,
		"warehouse_stocks",
		[]string{"guid"},
		fmt.Sprintf("product_variations_id = '%s'", variationID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("this product variation cannot be deleted because it is linked to warehouse stocks")
	}

	// Check shop inventory
	existing, err = utils.SelectItems(
		request,
		"shop_inventory",
		[]string{"guid"},
		fmt.Sprintf("product_variations_id = '%s'", variationID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("this product variation cannot be deleted because it is linked to shop iventory")
	}

	// Check stock movement items
	existing, err = utils.SelectItems(
		request,
		"stock_movement_items",
		[]string{"guid"},
		fmt.Sprintf("product_variations_id = '%s'", variationID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this product variation cannot be deleted because it is linked to stock movements",
		)
	}

	// Delete variation
	resp, err := request.UcodeSdk.
		Items("product_variations").
		Delete().
		Single(variationID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete product variation")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	return map[string]any{
		"message": "product variation deleted successfully",
		"data":    resp.Data,
	}, nil
}
