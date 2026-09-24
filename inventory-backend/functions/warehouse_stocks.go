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

func GetWarehouseStocks(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetWarehouseStocks function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	warehouseID := cast.ToString(data["warehouse_id"])
	search := cast.ToString(data["search"])

	if warehouseID == "" {
		return nil, fmt.Errorf("warehouse id is required")
	}

	warehouseID = strings.ReplaceAll(warehouseID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf(
		"warehouse_stocks:%s:%s",
		warehouseID,
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
		"ws.warehouse_id = '%s'",
		warehouseID,
	)

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND p.name ILIKE '%%%s%%'",
			search,
		)
	}

	stockData, err := utils.SelectJoin(
		request,
		"warehouse_stocks ws",
		[]string{
			"ws.guid",
			"ws.product_variations_id",
			"ws.quantity",

			"pv.guid AS variation_id",
			"pv.products_id",
			"pv.sku",
			"pv.images AS variation_images",
			"pv.size",
			"pv.color",

			"p.guid AS product_id",
			"p.name AS product_name",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "product_variations pv",
				"condition": "pv.guid = ws.product_variations_id",
			},
			{
				"type":      "LEFT",
				"table":     "products p",
				"condition": "p.guid = pv.products_id",
			},
		},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	stocks := make([]map[string]any, 0, len(stockData))

	for _, row := range stockData {
		stocks = append(stocks, map[string]any{
			"guid":                  row["guid"],
			"product_variations_id": row["product_variations_id"],
			"quantity":              row["quantity"],

			"variation_id":     row["variation_id"],
			"products_id":      row["products_id"],
			"sku":              row["sku"],
			"variation_images": row["variation_images"],
			"size":             row["size"],
			"color":            row["color"],

			"product_id":   row["product_id"],
			"product_name": row["product_name"],
		})
	}

	res := map[string]any{
		"stocks": stocks,
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

	// ---------------- Cleara Cache ----------------------
	invalidateWarehouseStocksCache(request, warehouseID)

	return map[string]any{
		"message": "warehouse stock created successfully",
		"guid":    guid,
	}, nil
}

func invalidateWarehouseStocksCache(request *models.FunctionRequest, productID string) {
	pattern := fmt.Sprintf("warehouse_stocks:list:%s",
		productID,
	)

	if err := redis.DeleteWildCard(request, pattern); err != nil {
		request.Logger.Error().
			Err(err).
			Str("pattern", pattern).
			Msg("cache invalidation failed")
	}
}
