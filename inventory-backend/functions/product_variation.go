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

func GetProductVariations(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetProductVariations function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	productID := cast.ToString(data["product_id"])
	search := cast.ToString(data["search"])

	if productID == "" {
		return nil, fmt.Errorf("product id is required")
	}

	productID = strings.ReplaceAll(productID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf(
		"product_variations:%s:%s",
		productID,
		request.Params.CacheClient.Hash(search),
	)
	var cached map[string]any
	err := redis.Get(request, cacheKey, &cached)
	if err == nil {
		return cached, nil
	}

	if !errors.Is(err, redis.ErrCacheMiss) {
		request.Logger.
			Err(err).
			Msg("redis get failed")
	}

	// --------------------------------------------------------------

	filter := fmt.Sprintf(
		"pv.products_id = '%s'",
		productID,
	)

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND (pv.sku ILIKE '%%%s%%' OR pv.size ILIKE '%%%s%%' OR pv.color ILIKE '%%%s%%')",
			search,
			search,
			search,
		)
	}

	variations, err := utils.SelectJoin(
		request,
		"product_variations pv",
		[]string{
			"pv.guid",
			"pv.products_id",
			"pv.sku",
			"pv.images",
			"pv.size",
			"pv.color",

			"p.name AS product_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "products p",
				"condition": "pv.products_id = p.guid",
			},
		},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"variations": variations,
	}

	// ---------------- Cache Set ------------------------
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

	productID = strings.ReplaceAll(productID, "'", "''")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	product, err := utils.SelectOneItem(
		request,
		"products",
		[]string{
			"guid",
			"code",
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
		return nil, fmt.Errorf("product not found")
	}

	merchantID := cast.ToString(product["merchants_id"])

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
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

	resp, raw, err := request.UcodeSdk.
		Items("product_variations").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create product variation")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ---------------- Cleara Cache ----------------------
	invalidateVariationCache(request, productID)

	return map[string]any{
		"message":  "product variation created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

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

	variationID = strings.ReplaceAll(variationID, "'", "''")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	variation, err := utils.SelectJoin(
		request,
		"product_variations pv",
		[]string{
			"pv.guid",
			"pv.products_id",
			"p.merchants_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "products p",
				"condition": "pv.products_id = p.guid",
			},
		},
		fmt.Sprintf(
			"pv.guid = '%s'",
			variationID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(variation) == 0 {
		return nil, fmt.Errorf("variation not found")
	}

	merchantID := cast.ToString(variation[0]["merchants_id"])
	productID := cast.ToString(variation[0]["products_id"])

	if err := utils.CanManage(access, merchantID); err != nil {
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

	// ------------------------ Cleare Cache -----------------------
	invalidateVariationCache(request, productID)
	return map[string]any{
		"message": "product variation updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

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

	variationID = strings.ReplaceAll(variationID, "'", "''")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	variation, err := utils.SelectJoin(
		request,
		"product_variations pv",
		[]string{
			"pv.guid",
			"pv.products_id",
			"p.merchants_id",
			"COUNT(DISTINCT ws.guid) AS warehouse_count",
			"COUNT(DISTINCT si.guid) AS shop_count",
			"COUNT(DISTINCT smi.guid) AS movement_count",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "products p",
				"condition": "pv.products_id = p.guid",
			},
			{
				"type":      "LEFT",
				"table":     "warehouse_stocks ws",
				"condition": "pv.guid = ws.product_variations_id",
			},
			{
				"type":      "LEFT",
				"table":     "shop_inventory si",
				"condition": "pv.guid = si.product_variations_id",
			},
			{
				"type":      "LEFT",
				"table":     "stock_movement_items smi",
				"condition": "pv.guid = smi.product_variations_id",
			},
		},
		fmt.Sprintf(
			"pv.guid = '%s'",
			variationID,
		),
		[]string{
			"pv.guid",
			"p.merchants_id",
		},
	)
	if err != nil {
		return nil, err
	}

	if len(variation) == 0 {
		return nil, fmt.Errorf("variation not found")
	}

	variationData := variation[0]

	merchantID := cast.ToString(variationData["merchants_id"])
	productID := cast.ToString(variationData["products_id"])

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	warehouseCount := cast.ToInt(
		variationData["warehouse_count"],
	)

	if warehouseCount > 0 {
		return nil, fmt.Errorf(
			"this product variation cannot be deleted because it is linked to warehouse stocks",
		)
	}

	shopCount := cast.ToInt(
		variationData["shop_count"],
	)

	if shopCount > 0 {
		return nil, fmt.Errorf(
			"this product variation cannot be deleted because it is linked to shop inventory",
		)
	}

	movementCount := cast.ToInt(
		variationData["movement_count"],
	)

	if movementCount > 0 {
		return nil, fmt.Errorf(
			"this product variation cannot be deleted because it is linked to stock movements",
		)
	}

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

	// ------------------- Clear Cache -----------------------
	invalidateVariationCache(request, productID)

	return map[string]any{
		"message": "product variation deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateVariationCache(request *models.FunctionRequest, productID string) {
	pattern := fmt.Sprintf("product_variations:list:%s",
		productID,
	)

	if err := redis.DeleteWildCard(request, pattern); err != nil {
		request.Logger.Error().
			Err(err).
			Str("pattern", pattern).
			Msg("cache invalidation failed")
	}
}
