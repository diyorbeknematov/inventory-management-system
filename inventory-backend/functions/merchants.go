package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/spf13/cast"
)

func GetMerchants(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchants triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	resp, raw, err := request.UcodeSdk.
		Items("users").
		GetSingle(request.UserId).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to get user")

		return nil, fmt.Errorf("failed to get user from database")
	}

	if resp.Data.Data.Response == nil {
		return nil, fmt.Errorf("user not found")
	}

	user := resp.Data.Data.Response

	merchantID := cast.ToString(user["merchants_id"])
	search := cast.ToString(data["search"])

	filter := "1=1"

	if merchantID != "" {
		filter = fmt.Sprintf(
			"guid = '%s'",
			strings.ReplaceAll(merchantID, "'", "''"),
		)
	}

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

	return map[string]any{
		"merchants": merchants,
	}, nil
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
		fmt.Sprintf("u.guid = '%s'", request.UserId),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(users[0]["role_name"])

	if roleName != "ADMIN" {
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

	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{
			"guid",
		},
		fmt.Sprintf("guid = '%s'", merchantID),
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
		fmt.Sprintf("u.guid = '%s'", request.UserId),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(users[0]["role_name"])

	if roleName == "ADMIN" {
		// Admin can update any merchant
	} else if roleName == "MERCHANT" {
		userMerchantID := cast.ToString(users[0]["merchants_id"])

		if userMerchantID != merchantID {
			return nil, fmt.Errorf(
				"you do not have permission to update this merchant",
			)
		}
	} else {
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

	merchant, err := utils.SelectOneItem(
		request,
		"merchants",
		[]string{
			"guid",
		},
		fmt.Sprintf("guid = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if merchant == nil {
		return nil, fmt.Errorf("merchant not found")
	}

	// Only ADMIN can delete merchant
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
		fmt.Sprintf("u.guid = '%s'", request.UserId),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(users[0]["role_name"])

	if roleName != "ADMIN" {
		return nil, fmt.Errorf(
			"only admin can delete merchants",
		)
	}

	// Check users
	existing, err := utils.SelectItems(
		request,
		"users",
		[]string{"guid"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has users",
		)
	}

	// Check categories
	existing, err = utils.SelectItems(
		request,
		"category",
		[]string{"guid"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has categories",
		)
	}

	// Check products
	existing, err = utils.SelectItems(
		request,
		"products",
		[]string{"guid"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has products",
		)
	}

	// Check warehouses
	existing, err = utils.SelectItems(
		request,
		"warehouses",
		[]string{"guid"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has warehouses",
		)
	}

	// Check shops
	existing, err = utils.SelectItems(
		request,
		"shops",
		[]string{"guid"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
		return nil, fmt.Errorf(
			"this merchant cannot be deleted because it has shops",
		)
	}

	// Check stock movements
	existing, err = utils.SelectItems(
		request,
		"stock_movements",
		[]string{"guid"},
		fmt.Sprintf("merchants_id = '%s'", merchantID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(existing) > 0 {
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
