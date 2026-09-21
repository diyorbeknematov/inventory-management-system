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
// CreateProduct
// -----------------------

func CreateProduct(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateProduct triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	merchantID := cast.ToString(data["merchants_id"])
	name := cast.ToString(data["name"])
	categoryID := cast.ToString(data["category_id"])
	images := utils.GetStringSlice(data["images"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchant_id is required")
	}

	if name == "" {
		return nil, fmt.Errorf("product name is required")
	}

	if categoryID == "" {
		return nil, fmt.Errorf("category_id is required")
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

	// Category
	category, err := utils.SelectOneItem(
		request,
		"category",
		[]string{"guid"},
		fmt.Sprintf("guid = '%s'", categoryID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if category == nil {
		return nil, fmt.Errorf("category not found")
	}

	// Product variations
	variations := utils.GetAnySlice(data["product_variations"])

	filter := fmt.Sprintf(
		"name = '%s' AND merchants_id = '%s'",
		strings.ReplaceAll(name, "'", "''"),
		merchantID,
	)

	existing, err := utils.SelectItems(
		request,
		"products",
		[]string{"guid"},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("product with this name already exists")
	}

	// Create product
	productGUID := uuid.New().String()
	productCode := utils.GenerateProductCode()

	createData := map[string]any{
		"guid":         productGUID,
		"name":         name,
		"code":         productCode,
		"merchants_id": merchantID,
		"category_id":  categoryID,
	}

	if len(images) > 0 {
		createData["images"] = images
	}

	resp, raw, err := request.UcodeSdk.Items("products").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create product")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// No variations
	if len(variations) == 0 {
		variationGUID := uuid.New().String()

		defaultSKU := utils.GenerateSKU(productCode, "", "")

		createVariantData := map[string]any{
			"guid":        variationGUID,
			"sku":         defaultSKU,
			"products_id": productGUID,
		}

		_, raw, err := request.UcodeSdk.Items("product_variations").
			Create(createVariantData).
			Exec()

		if err != nil {
			request.Logger.
				Err(err).
				Interface("response", raw).
				Msg("failed to create default product variation")

			deleteErr := utils.DeleteItemsByIDs(
				request,
				"products",
				[]string{productGUID},
			)

			if deleteErr != nil {
				request.Logger.
					Err(deleteErr).
					Msg("failed to rollback created product")
			}

			return nil, utils.ExtractUcodeError(raw, err)
		}

		return map[string]any{
			"message":  "product created successfully",
			"response": resp.Data.Data.Data,
		}, nil
	}

	// Create variations
	createdVariationIDs := make([]string, 0, len(variations))

	for i, v := range variations {
		variant, ok := v.(map[string]any)
		if !ok {
			rollbackErr := utils.DeleteItemsByIDs(
				request,
				"products",
				[]string{productGUID},
			)

			if rollbackErr != nil {
				request.Logger.
					Err(rollbackErr).
					Msg("failed to rollback created product")
			}

			return nil, fmt.Errorf(
				"%d - product variation is invalid",
				i,
			)
		}

		varImages := utils.GetStringSlice(variant["images"])
		size := cast.ToString(variant["size"])
		color := cast.ToString(variant["color"])
		sku := utils.GenerateSKU(productCode, color, size)

		// Check SKU uniqueness
		existingSKU, err := utils.SelectItems(
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

		if len(existingSKU) > 0 {
			rollbackErr := utils.DeleteItemsByIDs(
				request,
				"products",
				[]string{productGUID},
			)

			if rollbackErr != nil {
				request.Logger.
					Err(rollbackErr).
					Msg("failed to rollback created product")
			}

			return nil, fmt.Errorf(
				"%d - sku already exists",
				i,
			)
		}

		variantGUID := uuid.New().String()

		createVariantData := map[string]any{
			"guid":        variantGUID,
			"sku":         sku,
			"products_id": productGUID,
		}

		if len(varImages) > 0 {
			createVariantData["images"] = varImages
		}

		if size != "" {
			createVariantData["size"] = size
		}

		if color != "" {
			createVariantData["color"] = color
		}

		_, raw2, err := request.UcodeSdk.Items("product_variations").
			Create(createVariantData).
			Exec()

		if err != nil {
			request.Logger.
				Err(err).
				Interface("response", raw2).
				Msg("failed to create product variation")

			// Rollback created variations
			if len(createdVariationIDs) > 0 {
				deleteErr := utils.DeleteItemsByIDs(
					request,
					"product_variations",
					createdVariationIDs,
				)

				if deleteErr != nil {
					request.Logger.
						Err(deleteErr).
						Msg("failed to rollback created variations")
				}
			}

			// Rollback product
			deleteErr := utils.DeleteItemsByIDs(
				request,
				"products",
				[]string{productGUID},
			)

			if deleteErr != nil {
				request.Logger.
					Err(deleteErr).
					Msg("failed to rollback created product")
			}

			return nil, utils.ExtractUcodeError(raw, err)
		}

		createdVariationIDs = append(
			createdVariationIDs,
			variantGUID,
		)
	}

	return map[string]any{
		"message":  "product created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

func UpdateProduct(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateProduct function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	productID := cast.ToString(data["product_id"])

	if productID == "" {
		return nil, fmt.Errorf("product_id is required")
	}

	// Get product merchant
	product, err := utils.SelectOneItem(
		request,
		"products",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", productID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if product == nil {
		return nil, fmt.Errorf("product not found")
	}

	merchantID := cast.ToString(product["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": productID,
	}

	// Update name
	name := cast.ToString(data["name"])

	if name != "" {
		updateData["name"] = name
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

	// Update category
	categoryID := cast.ToString(data["category_id"])

	if categoryID != "" {

		category, err := utils.SelectOneItem(
			request,
			"category",
			[]string{
				"guid",
				"merchants_id",
			},
			fmt.Sprintf("guid = '%s'", categoryID),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if category == nil {
			return nil, fmt.Errorf("category not found")
		}

		categoryMerchantID := cast.ToString(category["merchants_id"])

		if categoryMerchantID != merchantID {
			return nil, fmt.Errorf(
				"you cannot assign a category from another merchant",
			)
		}

		updateData["category_id"] = categoryID
	}

	resp, raw, err := request.UcodeSdk.
		Items("products").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update product")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "product updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

func DeleteProduct(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteProduct function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	productID := cast.ToString(data["product_id"])

	if productID == "" {
		return nil, fmt.Errorf("product_id is required")
	}

	product, err := utils.SelectOneItem(
		request,
		"products",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", productID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if product == nil {
		return nil, fmt.Errorf("product not found")
	}

	merchantID := cast.ToString(product["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	// Check products variations
	existing, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{"guid"},
		fmt.Sprintf("products_id = '%s'", productID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("this product cannot be deleted because it has variations")
	}

	// Delete product
	resp, err := request.UcodeSdk.
		Items("products").
		Delete().
		Single(productID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete product")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	return map[string]any{
		"message": "product deleted successfully",
		"data":    resp.Data,
	}, nil
}
