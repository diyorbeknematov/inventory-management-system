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
// CreateCategory
// -----------------------

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

	if merchantID == "" {
		return nil, fmt.Errorf("merchants_id is required")
	}

	if name == "" {
		return nil, fmt.Errorf("category name is ruqired")
	}

	filter := fmt.Sprintf(
		"merchants_id = '%s' AND name = '%s'",
		merchantID,
		strings.ReplaceAll(name, "'", "''"),
	)

	if categoryID == "" {
		filter += " AND category_id IS NULL"
	} else {
		filter += fmt.Sprintf(" AND category_id = '%s'", categoryID)
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
		return nil, fmt.Errorf("category with this name already exists")
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

	resp, raw, err := request.UcodeSdk.Items("category").
		Create(createData).
		Exec()
	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create category")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message":  "category created sucessfully",
		"response": resp.Data.Data.Data,
	}, nil
}

// UpdateCatory
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

	// Get category merchant
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

	merchantID := cast.ToString(category["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
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

	return map[string]any{
		"message": "category updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

func DeleteCategory(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteCategory function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	categoryID := cast.ToString(data["category_id"])

	if categoryID == "" {
		return nil, fmt.Errorf("category_id is required")
	}

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

	merchantID := cast.ToString(category["merchants_id"])

	if err := utils.CheckMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	// Check child categories
	existing, err := utils.SelectItems(
		request,
		"category",
		[]string{"guid"},
		fmt.Sprintf("category_id = '%s'", categoryID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("this category cannot be deleted because it has subcategories")
	}

	// Check products
	existing, err = utils.SelectItems(
		request,
		"products",
		[]string{"guid"},
		fmt.Sprintf("category_id = '%s'", categoryID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf("this category cannot be deleted because it is linked to products")
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

	return map[string]any{
		"message": "category deleted successfully",
		"data":    resp.Data,
	}, nil
}
