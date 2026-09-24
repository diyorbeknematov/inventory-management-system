package helper

import (
	"errors"
	"fmt"
	"function/functions/redis"
	"function/functions/utils"
	"function/models"
	"strings"
	"time"

	"github.com/spf13/cast"
)

// Get Merchants for select
func GetMerchantsForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantsForSelect triggered")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Only Admin can select a merchant.
	if access.RoleName != "Admin" {
		return nil, fmt.Errorf("permission denied")
	}

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("merchants:list:for_select:%s",
		request.UserId,
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

	merchants, err := utils.SelectItems(
		request,
		"merchants",
		[]string{
			"guid",
			"name",
		},
		"1=1",
		[]string{},
	)
	if err != nil {
		request.Logger.
			Err(err).
			Msg("failed to get merchants")

		return nil, err
	}

	res := map[string]any{
		"merchants": merchants,
	}

	// ------------------- Cache Set -------------------------
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

// Get Roles for select
func GetRolesForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetRolesForSelect triggered")

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Only Admin can select a merchant.
	if access.RoleName != "Admin" {
		return nil, fmt.Errorf("permission denied")
	}

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("roles:list:for_select:%s",
		request.UserId,
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

	roles, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"r.name",
			"r.guid",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "u.client_type_id = r.client_type_id",
			},
		},
		fmt.Sprintf("u.guid = '%s'", request.UserId),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"roles": roles,
	}

	// ------------------- Cache Set -------------------------
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

// Get Shops for select

func GetShopsForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetShopsForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Admin can select any merchant.
	if access.RoleName == "Admin" {
		if merchantID == "" {
			return nil, fmt.Errorf("merchants_id is required")
		}
	} else {
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf(
				"merchant access is not configured",
			)
		}
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("shops:list:for_select:%s",
		request.UserId,
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

	shopFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		merchantID,
	)

	if shopID != "" {
		shopID = strings.ReplaceAll(shopID, "'", "''")

		shopFilter += fmt.Sprintf(
			" AND guid = '%s'",
			shopID,
		)
	}

	shops, err := utils.SelectItems(
		request,
		"shops",
		[]string{
			"guid",
			"name",
			"merchants_id",
		},
		shopFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"shops": shops,
	}

	// ------------------- Cache Set -------------------------
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

// Get Warehouses for select
func GetWarehousesForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetWarehousesForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(
		data["merchants_id"],
	)

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Admin can select any merchant.
	if access.RoleName == "Admin" {
		if merchantID == "" {
			return nil, fmt.Errorf("merchants_id is required")
		}
	} else {
		// Other users can only access their own merchant.
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf(
				"merchant access is not configured",
			)
		}
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("warehouses:list:for_select:%s",
		request.UserId,
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

	warehouseFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		merchantID,
	)

	warehouses, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{
			"guid",
			"name",
			"merchants_id",
		},
		warehouseFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"warehouses": warehouses,
	}

	// ------------------- Cache Set -------------------------
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

// Get Products for select

func GetProductsForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetProductsForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(
		data["merchants_id"],
	)

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Admin can select products from any merchant.
	if access.RoleName == "Admin" {
		if merchantID == "" {
			return nil, fmt.Errorf("merchants_id is required")
		}
	} else {
		// Other users can only access their own merchant.
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf(
				"merchant access is not configured",
			)
		}
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("products:list:for_select:%s",
		request.UserId,
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

	productFilter := fmt.Sprintf(
		"p.merchants_id = '%s'",
		merchantID,
	)

	productData, err := utils.SelectJoin(
		request,
		"products p",
		[]string{
			"p.guid",
			"p.name",
			"p.category_id",
			"p.merchants_id",

			"pv.guid AS variation_id",
			"pv.sku",
			"pv.size",
			"pv.color",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "product_variations pv",
				"condition": "pv.products_id = p.guid",
			},
		},
		productFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	products := make([]map[string]any, 0)
	productMap := make(map[string]map[string]any)

	for _, row := range productData {
		productID := cast.ToString(
			row["guid"],
		)

		product, exists := productMap[productID]

		if !exists {
			product = map[string]any{
				"guid":         productID,
				"name":         row["name"],
				"category_id":  row["category_id"],
				"merchants_id": row["merchants_id"],
				"variations":   []map[string]any{},
			}

			productMap[productID] = product
			products = append(products, product)
		}

		variationID := cast.ToString(
			row["variation_id"],
		)

		if variationID != "" {
			variations := product["variations"].([]map[string]any)

			variations = append(
				variations,
				map[string]any{
					"guid":  variationID,
					"sku":   row["sku"],
					"size":  row["size"],
					"color": row["color"],
				},
			)

			product["variations"] = variations
		}
	}

	res := map[string]any{
		"products": products,
	}

	// ------------------- Cache Set -------------------------
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
