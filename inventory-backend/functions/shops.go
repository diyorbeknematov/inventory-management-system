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

// Get Shops
func GetShops(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantShops function triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	shopID := cast.ToString(data["shop_id"])
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

	fmt.Println(
		"CacheClient", request.Params.CacheClient,
	)
	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("shops:list:%s:%s",
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
			" AND s.merchants_id = '%s'",
			merchantID,
		)
	}

	if shopID != "" {
		shopID = strings.ReplaceAll(shopID, "'", "''")

		filter += fmt.Sprintf(
			" AND s.guid = '%s'",
			shopID,
		)
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND s.name ILIKE '%%%s%%'",
			search,
		)
	}

	shops, err := utils.SelectItems(
		request,
		"shops s",
		[]string{
			"s.guid",
			"s.name",
			"s.logo",
			"s.phone",
			"s.email",
			"s.address",
			"s.merchants_id",
		},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"shops": shops,
	}

	// ----------------------- Cache Set ----------------------
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
	logo := cast.ToString(data["logo"])
	phone := cast.ToString(data["phone"])
	email := cast.ToString(data["email"])
	address := cast.ToString(data["address"])

	if name == "" {
		return nil, fmt.Errorf("shop name is required")
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
	name = strings.ReplaceAll(name, "'", "''")

	// Check duplicate shop name inside merchant
	result, err := utils.SelectJoin(
		request,
		"merchants m",
		[]string{
			"m.guid",
			"s.guid AS shop_guid",
		},
		[]map[string]string{
			{
				"type":  "LEFT",
				"table": "shops s",
				"condition": fmt.Sprintf(
					"s.merchants_id = m.guid AND s.name = '%s'",
					name,
				),
			},
		},
		fmt.Sprintf(
			"m.guid = '%s'",
			merchantID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("merchant not found")
	}

	if cast.ToString(result[0]["shop_guid"]) != "" {
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

	resp, raw, err := request.UcodeSdk.
		Items("shops").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create shop")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateShopsCache(request, merchantID)

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

	shopID = strings.ReplaceAll(shopID, "'", "''")

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

	if len(shop) == 0 {
		return nil, fmt.Errorf("shop not found")
	}

	merchantID := cast.ToString(shop["merchants_id"])

	// Check access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": shopID,
	}

	name := cast.ToString(data["name"])
	if name != "" {
		name = strings.ReplaceAll(name, "'", "''")
		updateData["name"] = name
	}

	logo := cast.ToString(data["logo"])
	if logo != "" {
		updateData["logo"] = logo
	}

	phone := cast.ToString(data["phone"])
	if phone != "" {
		updateData["phone"] = phone
	}

	email := cast.ToString(data["email"])
	if email != "" {
		updateData["email"] = email
	}

	address := cast.ToString(data["address"])
	if address != "" {
		address = strings.ReplaceAll(address, "'", "''")
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

	// ---------------------------  Cleare Cache -----------------------
	invalidateShopsCache(request, merchantID)

	return map[string]any{
		"message": "shop updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

// Delete Shop
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

	shopID = strings.ReplaceAll(shopID, "'", "''")

	shop, err := utils.SelectJoin(
		request,
		"shops s",
		[]string{
			"s.guid",
			"s.merchants_id",
			"COUNT(DISTINCT si.guid) AS inventory_count",
			"COUNT(DISTINCT sm.guid) AS movement_count",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "shop_inventory si",
				"condition": "si.shops_id = s.guid",
			},
			{
				"type":      "LEFT",
				"table":     "stock_movements sm",
				"condition": "(sm.shops_id = s.guid OR sm.shops_id_2 = s.guid)",
			},
		},
		fmt.Sprintf("s.guid = '%s'", shopID),
		[]string{
			"s.guid",
			"s.merchants_id",
		},
	)
	if err != nil {
		return nil, err
	}

	if len(shop) == 0 {
		return nil, fmt.Errorf("shop not found")
	}

	shopData := shop[0]

	merchantID := cast.ToString(shopData["merchants_id"])

	// Check access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	inventoryCount := cast.ToInt(shopData["inventory_count"])

	if inventoryCount > 0 {
		return nil, fmt.Errorf(
			"this shop cannot be deleted because it has inventory",
		)
	}

	movementCount := cast.ToInt(shopData["movement_count"])

	if movementCount > 0 {
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

	// ---------------------------  Cleare Cache -----------------------
	invalidateShopsCache(request, merchantID)

	return map[string]any{
		"message": "shop deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateShopsCache(request *models.FunctionRequest, merchantID string) {
	patterns := []string{
		fmt.Sprintf("shops:list:%s:*", merchantID), // shu merchant
		"shops:list::*", // Admin "hammasi" ro'yxati
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
