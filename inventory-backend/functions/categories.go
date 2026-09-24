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

func GetCategories(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetCategories triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	search := cast.ToString(data["search"])

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

	// ---------------- Cache Get ----------------------
	cacheKey := fmt.Sprintf("categories:list:%s:%s",
		merchantID,
		request.Params.CacheClient.Hash(search),
	)

	var cached map[string]any

	err = redis.Get(request, cacheKey, &cached)
	if err == nil {
		return cached, nil
	}

	if !errors.Is(err, redis.ErrCacheMiss) {
		request.Logger.
			Err(err).
			Msg("redis get failed")
	}

	// ---------------------------------------------------

	filter := "1=1"

	if merchantID != "" {
		merchantID = strings.ReplaceAll(merchantID, "'", "''")

		filter += fmt.Sprintf(
			" AND merchants_id = '%s'",
			merchantID,
		)
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND name ILIKE '%%%s%%'",
			search,
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
			"merchants_id",
		},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"categories": categories,
	}

	// ------------------- Cache Set ------------------------
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

// Create Category
func CreateCategory(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateCategory triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	merchantID := cast.ToString(data["merchants_id"])
	name := cast.ToString(data["name"])
	description := cast.ToString(data["description"])
	categoryID := cast.ToString(data["category_id"])

	if name == "" {
		return nil, fmt.Errorf("category name is required")
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if access.RoleName != "Admin" {
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf("merchant access is not configured")
		}
	} else if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")

	name = strings.ReplaceAll(name, "'", "''")

	filter := fmt.Sprintf(
		"merchants_id = '%s' AND name = '%s'",
		merchantID,
		name,
	)

	if categoryID == "" {
		filter += " AND category_id IS NULL"
	} else {
		categoryID = strings.ReplaceAll(categoryID, "'", "''")

		filter += fmt.Sprintf(
			" AND category_id = '%s'",
			categoryID,
		)
	}

	existing, err := utils.SelectItems(
		request,
		"category",
		[]string{"guid"},
		filter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"category with this name already exists",
		)
	}

	guid := uuid.New().String()

	createData := map[string]any{
		"guid":         guid,
		"name":         name,
		"description":  description,
		"merchants_id": merchantID,
	}

	if categoryID != "" {
		createData["category_id"] = categoryID
	}

	resp, raw, err := request.UcodeSdk.
		Items("category").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create category")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ----------------------- Clear Cache ---------------------
	invalidateCategoriesCache(request, merchantID)

	return map[string]any{
		"message":  "category created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

// -----------------------
// UpdateCategory
// -----------------------

func UpdateCategory(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateCategory function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	categoryID := cast.ToString(data["guid"])
	name := cast.ToString(data["name"])
	description := cast.ToString(data["description"])

	if categoryID == "" {
		return nil, fmt.Errorf("guid is required")
	}

	categoryID = strings.ReplaceAll(
		categoryID,
		"'",
		"''",
	)

	// Get category merchant
	category, err := utils.SelectOneItem(
		request,
		"category",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf(
			"guid = '%s'",
			categoryID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if category == nil {
		return nil, fmt.Errorf("category not found")
	}

	merchantID := cast.ToString(
		category["merchants_id"],
	)

	if merchantID == "" {
		return nil, fmt.Errorf(
			"category merchant is missing",
		)
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": categoryID,
	}

	if name != "" {
		updateData["name"] = name
	}

	if description != "" {
		updateData["description"] = description
	}

	resp, raw, err := request.UcodeSdk.
		Items("category").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update category")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ----------------------- Clear Cache ---------------------
	invalidateCategoriesCache(request, merchantID)

	return map[string]any{
		"message": "category updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

// -----------------------
// DeleteCategory
// -----------------------

func DeleteCategory(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteCategory function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	categoryID := cast.ToString(
		data["category_id"],
	)

	if categoryID == "" {
		return nil, fmt.Errorf("category_id is required")
	}

	categoryID = strings.ReplaceAll(
		categoryID,
		"'",
		"''",
	)

	category, err := utils.SelectJoin(
		request,
		"category c",
		[]string{
			"c.guid",
			"c.merchants_id",
			"COUNT(DISTINCT child.guid) AS child_count",
			"COUNT(DISTINCT p.guid) AS product_count",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "category child",
				"condition": "child.category_id = c.guid",
			},
			{
				"type":      "LEFT",
				"table":     "products p",
				"condition": "p.category_id = c.guid",
			},
		},
		fmt.Sprintf(
			"c.guid = '%s'",
			categoryID,
		),
		[]string{
			"c.guid",
			"c.merchants_id",
		},
	)
	if err != nil {
		return nil, err
	}

	if len(category) == 0 {
		return nil, fmt.Errorf("category not found")
	}

	categoryData := category[0]

	merchantID := cast.ToString(
		categoryData["merchants_id"],
	)

	if merchantID == "" {
		return nil, fmt.Errorf(
			"category merchant is missing",
		)
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	childCount := cast.ToInt(
		categoryData["child_count"],
	)

	if childCount > 0 {
		return nil, fmt.Errorf(
			"this category cannot be deleted because it has subcategories",
		)
	}

	productCount := cast.ToInt(
		categoryData["product_count"],
	)

	if productCount > 0 {
		return nil, fmt.Errorf(
			"this category cannot be deleted because it is linked to products",
		)
	}

	// Delete category
	resp, err := request.UcodeSdk.
		Items("category").
		Delete().
		Single(categoryID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete category")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	// ----------------------- Clear Cache ---------------------
	invalidateCategoriesCache(request, merchantID)

	return map[string]any{
		"message": "category deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateCategoriesCache(request *models.FunctionRequest, merchantID string) {
	patterns := []string{
		fmt.Sprintf("categories:list:%s:*", merchantID), // shu merchant
		"categories:list::*",                            // Admin "hammasi" ro'yxati
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
