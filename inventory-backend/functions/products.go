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

// Get Products
func GetProducts(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantProducts triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

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
	cacheKey := fmt.Sprintf("products:list:%s:%s",
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
			" AND p.merchants_id = '%s'",
			merchantID,
		)
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND p.name ILIKE '%%%s%%'",
			search,
		)
	}

	products, err := utils.SelectItems(
		request,
		"products p",
		[]string{
			"p.guid",
			"p.name",
			"p.images",
			"p.category_id",
			"p.merchants_id",
		},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	productsByCategory := utils.GroupBy(products, "category_id")

	categoryFilter := "1=1"

	if merchantID != "" {
		categoryFilter = fmt.Sprintf(
			"merchants_id = '%s'",
			merchantID,
		)
	}

	categories, err := utils.SelectItems(
		request,
		"category",
		[]string{
			"guid",
			"name",
			"description",
			"category_id",
		},
		categoryFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	subCategoriesByParent := utils.GroupBy(categories, "category_id")

	rootCategories := subCategoriesByParent[""]

	resultCategories := make([]map[string]any, 0, len(rootCategories))

	for _, category := range rootCategories {
		tree := utils.BuildCategoryTree(
			category,
			subCategoriesByParent,
			productsByCategory,
		)

		if tree != nil {
			resultCategories = append(resultCategories, tree)
		}
	}

	res := map[string]any{
		"products":   products,
		"categories": resultCategories,
	}

	// ------------- Cache Set --------------
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

// Create Product
func CreateProduct(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateProduct triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	name := cast.ToString(data["name"])
	categoryID := cast.ToString(data["category_id"])
	images := utils.GetStringSlice(data["images"])

	if name == "" {
		return nil, fmt.Errorf("product name is required")
	}

	if categoryID == "" {
		return nil, fmt.Errorf("category_id is required")
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

	merchantID = strings.ReplaceAll(merchantID, "'", "''")
	categoryID = strings.ReplaceAll(categoryID, "'", "''")
	name = strings.ReplaceAll(name, "'", "''")

	// Category
	category, err := utils.SelectOneItem(
		request,
		"category",
		[]string{"guid", "merchants_id"},
		fmt.Sprintf("guid = '%s'", categoryID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if category == nil {
		return nil, fmt.Errorf("category not found")
	}

	if cast.ToString(category["merchants_id"]) != merchantID {
		return nil, fmt.Errorf("category does not belong to this merchant")
	}

	// Product variations
	variations := utils.GetAnySlice(data["product_variations"])

	filter := fmt.Sprintf(
		"name = '%s' AND merchants_id = '%s'",
		name,
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

	// ---------- No variations ----------
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

		// --------------------- Cleare Cache 1 ----------------------
		invalidateProductsCache(request, merchantID)

		return map[string]any{
			"message":  "product created successfully",
			"response": resp.Data.Data.Data,
		}, nil
	}

	// ---------- Create variations ----------
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

			return nil, fmt.Errorf("%d - product variation is invalid", i)
		}

		varImages := utils.GetStringSlice(variant["images"])
		size := cast.ToString(variant["size"])
		color := cast.ToString(variant["color"])
		sku := utils.GenerateSKU(productCode, color, size)

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

			return nil, utils.ExtractUcodeError(raw2, err)
		}

		createdVariationIDs = append(createdVariationIDs, variantGUID)
	}

	// ------------------- Clear Cache 2 ---------------------
	invalidateProductsCache(request, merchantID)

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

	productID = strings.ReplaceAll(productID, "'", "''")

	categoryID := cast.ToString(data["category_id"])

	if categoryID != "" {
		categoryID = strings.ReplaceAll(categoryID, "'", "''")
	}

	// Get current user access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Get product + category merchant in one request
	product, err := utils.SelectJoin(
		request,
		"products p",
		[]string{
			"p.guid",
			"p.merchants_id",
			"c.guid AS category_id",
			"c.merchants_id AS category_merchants_id",
		},
		[]map[string]string{
			{
				"type":  "LEFT",
				"table": "category c",
				"condition": fmt.Sprintf(
					"c.guid = '%s'",
					categoryID,
				),
			},
		},
		fmt.Sprintf(
			"p.guid = '%s'",
			productID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(product) == 0 {
		return nil, fmt.Errorf("product not found")
	}

	productData := product[0]

	merchantID := cast.ToString(productData["merchants_id"])

	// Check product access
	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	// Validate category if provided
	if categoryID != "" {
		categoryMerchantID := cast.ToString(
			productData["category_merchants_id"],
		)

		if categoryMerchantID == "" {
			return nil, fmt.Errorf("category not found")
		}

		if categoryMerchantID != merchantID {
			return nil, fmt.Errorf(
				"you cannot assign a category from another merchant",
			)
		}
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
	if categoryID != "" {
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

	// ------------------ Clear Cache --------------------------
	invalidateProductsCache(request, merchantID)

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

	productID = strings.ReplaceAll(productID, "'", "''")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	product, err := utils.SelectJoin(
		request,
		"products p",
		[]string{
			"p.guid",
			"p.merchants_id",
			"COUNT(DISTINCT pv.guid) AS variation_count",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "product_variations pv",
				"condition": "p.guid = pv.products_id",
			},
		},
		fmt.Sprintf(
			"p.guid = '%s'",
			productID,
		),
		[]string{
			"p.guid",
			"p.merchants_id",
		},
	)
	if err != nil {
		return nil, err
	}

	if len(product) == 0 {
		return nil, fmt.Errorf("product not found")
	}

	productData := product[0]

	merchantID := cast.ToString(productData["merchants_id"])

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	variationCount := cast.ToInt(productData["variation_count"])

	if variationCount > 0 {
		return nil, fmt.Errorf(
			"this product cannot be deleted because it has variations",
		)
	}

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

	// ---------------------------  Cleare Cache -----------------------
	invalidateProductsCache(request, merchantID)
	
	return map[string]any{
		"message": "product deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateProductsCache(request *models.FunctionRequest, merchantID string) {
	patterns := []string{
		fmt.Sprintf("products:list:%s:*", merchantID), // shu merchant
		"products:list::*",                            // Admin "hammasi" ro'yxati
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
