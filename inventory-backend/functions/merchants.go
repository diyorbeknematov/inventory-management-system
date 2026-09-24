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

func GetMerchants(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchants triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	search := cast.ToString(data["search"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if access.RoleName != "Admin" {
		return nil, fmt.Errorf("you do not have permission to access this data")
	}

	// -------------------- Cache Get ------------------------
	cacheKey := fmt.Sprintf("merchants:list:%s",
		request.UserId,
	)

	var cached map[string]any

	err = redis.Get(request, cacheKey, &cached)
	if err == nil {
		return cached, nil
	}

	if !errors.Is(err, redis.ErrCacheMiss) {
		request.Logger.Err(err).Msg("redis get failed")
	}

	// -------------------------------------------------------

	filter := "1=1"

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND name ILIKE '%%%s%%'",
			search,
		)
	}

	merchants, err := utils.SelectItems(
		request,
		"merchants",
		[]string{
			"guid",
			"name",
		},
		filter,
		[]string{},
	)
	if err != nil {
		request.Logger.
			Err(err).
			Msg("failed to get merchants")

		return nil, fmt.Errorf("failed to get merchants")
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

func CreateMerchant(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateMerchant function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	// Check current user's role
	users, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"r.name AS role_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "u.role_id = r.guid",
			},
		},
		fmt.Sprintf(
			"u.guid = '%s'",
			strings.ReplaceAll(request.UserId, "'", "''"),
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(users[0]["role_name"])

	if roleName != "Admin" {
		return nil, fmt.Errorf(
			"only admin can create merchants",
		)
	}

	name := cast.ToString(data["name"])
	description := cast.ToString(data["description"])
	logo := cast.ToString(data["logo"])

	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	merchantData := map[string]any{
		"name": name,
	}

	if description != "" {
		merchantData["description"] = description
	}

	if logo != "" {
		merchantData["logo"] = logo
	}

	resp, raw, err := request.UcodeSdk.
		Items("merchants").
		Create(merchantData).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", raw).
			Msg("failed to create merchant")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "merchant created successfully",
		"data":    resp.Data,
	}, nil
}

func UpdateMerchant(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateMerchant function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	merchantID := cast.ToString(data["merchant_id"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchant_id is required")
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")

	// Check merchant
	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{
			"guid",
		},
		fmt.Sprintf(
			"guid = '%s'",
			merchantID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if merchant == nil {
		return nil, fmt.Errorf("merchant not found")
	}

	// Check current user's access
	users, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"r.name AS role_name",
			"u.merchants_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "u.role_id = r.guid",
			},
		},
		fmt.Sprintf(
			"u.guid = '%s'",
			strings.ReplaceAll(request.UserId, "'", "''"),
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(users[0]["role_name"])

	switch roleName {
	case "Admin":
		// Admin can update any merchant

	case "Merchant":
		userMerchantID := cast.ToString(users[0]["merchants_id"])

		if userMerchantID != merchantID {
			return nil, fmt.Errorf(
				"you do not have permission to update this merchant",
			)
		}

	default:
		return nil, fmt.Errorf(
			"you do not have permission to update this merchant",
		)
	}

	updateData := map[string]any{
		"guid": merchantID,
	}

	name := cast.ToString(data["name"])
	if name != "" {
		updateData["name"] = name
	}

	description := cast.ToString(data["description"])
	if description != "" {
		updateData["description"] = description
	}

	logo := cast.ToString(data["logo"])
	if logo != "" {
		updateData["logo"] = logo
	}

	resp, raw, err := request.UcodeSdk.
		Items("merchants").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", raw).
			Msg("failed to update merchant")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "merchant updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

func DeleteMerchant(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteMerchant function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	merchantID := cast.ToString(data["merchant_id"])

	if merchantID == "" {
		return nil, fmt.Errorf("merchant_id is required")
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")

	// Check current user's role
	users, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"r.name AS role_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "u.role_id = r.guid",
			},
		},
		fmt.Sprintf(
			"u.guid = '%s'",
			strings.ReplaceAll(request.UserId, "'", "''"),
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(users[0]["role_name"])

	if roleName != "Admin" {
		return nil, fmt.Errorf(
			"only admin can delete merchants",
		)
	}

	// Check merchant and all related data in one query
	merchantData, err := utils.SelectJoin(
		request,
		"merchants m",
		[]string{
			"m.guid",

			"COUNT(DISTINCT u.guid) AS users_count",
			"COUNT(DISTINCT c.guid) AS categories_count",
			"COUNT(DISTINCT p.guid) AS products_count",
			"COUNT(DISTINCT w.guid) AS warehouses_count",
			"COUNT(DISTINCT s.guid) AS shops_count",
			"COUNT(DISTINCT sm.guid) AS stock_movements_count",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "users u",
				"condition": "u.merchants_id = m.guid",
			},
			{
				"type":      "LEFT",
				"table":     "category c",
				"condition": "c.merchants_id = m.guid",
			},
			{
				"type":      "LEFT",
				"table":     "products p",
				"condition": "p.merchants_id = m.guid",
			},
			{
				"type":      "LEFT",
				"table":     "warehouse w",
				"condition": "w.merchants_id = m.guid",
			},
			{
				"type":      "LEFT",
				"table":     "shops s",
				"condition": "s.merchants_id = m.guid",
			},
			{
				"type":      "LEFT",
				"table":     "stock_movements sm",
				"condition": "sm.merchants_id = m.guid",
			},
		},
		fmt.Sprintf(
			"m.guid = '%s'",
			merchantID,
		),
		[]string{
			"m.guid",
		},
	)
	if err != nil {
		return nil, err
	}

	if len(merchantData) == 0 {
		return nil, fmt.Errorf("merchant not found")
	}

	row := merchantData[0]

	if cast.ToInt(row["users_count"]) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has users",
		)
	}

	if cast.ToInt(row["categories_count"]) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has categories",
		)
	}

	if cast.ToInt(row["products_count"]) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has products",
		)
	}

	if cast.ToInt(row["warehouses_count"]) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has warehouses",
		)
	}

	if cast.ToInt(row["shops_count"]) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has shops",
		)
	}

	if cast.ToInt(row["stock_movements_count"]) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has stock movements",
		)
	}

	resp, err := request.UcodeSdk.
		Items("merchants").
		Delete().
		Single(merchantID).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("failed to delete merchant")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	return map[string]any{
		"message": "merchant deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateMerchantsCache(request *models.FunctionRequest, userID string) {
	pattern := fmt.Sprintf("merchants:list:%s",
		userID,
	)

	if err := redis.DeleteWildCard(request, pattern); err != nil {
		request.Logger.Error().
			Err(err).
			Str("pattern", pattern).
			Msg("cache invalidation failed")
	}
}
