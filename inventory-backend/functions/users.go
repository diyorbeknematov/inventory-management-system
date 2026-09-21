package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

func GetUsers(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetUsers triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	search := cast.ToString(data["search"])

	// Current user
	currentUser, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"u.merchants_id",
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
		request.Logger.
			Err(err).
			Msg("failed to get current user")

		return nil, err
	}

	if len(currentUser) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	roleName := cast.ToString(currentUser[0]["role_name"])
	merchantID := cast.ToString(currentUser[0]["merchants_id"])

	// Faqat Admin va Merchant Users sahifasidan foydalana oladi.
	if roleName != "Admin" && roleName != "Merchant" {
		return nil, fmt.Errorf(
			"you do not have permission to view users",
		)
	}

	// User filter
	filter := "1=1"

	// Merchant faqat o'z merchantidagi userlarni ko'radi.
	if roleName == "Merchant" {
		if merchantID == "" {
			return nil, fmt.Errorf(
				"merchant_id is required",
			)
		}

		filter = fmt.Sprintf(
			"u.merchants_id = '%s'",
			strings.ReplaceAll(merchantID, "'", "''"),
		)
	}

	// Search
	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND ("+
				"u.login ILIKE '%%%s%%' OR "+
				"u.full_name ILIKE '%%%s%%' OR "+
				"u.email ILIKE '%%%s%%'"+
				")",
			search,
			search,
			search,
		)
	}

	joins := []map[string]string{
		{
			"type":      "INNER",
			"table":     "role r",
			"condition": "u.role_id = r.guid",
		},
		{
			"type":      "LEFT",
			"table":     "merchants m",
			"condition": "u.merchants_id = m.guid",
		},
		{
			"type":      "LEFT",
			"table":     "user_memberships um",
			"condition": "u.guid = um.users_id",
		},
		{
			"type":  "LEFT",
			"table": "shops s",
			"condition": `
				'SHOP' = ANY(um.scope_type)
				AND um.scope_id = s.guid::text
        	`,
		},
		{
			"type":  "LEFT",
			"table": "warehouse w",
			"condition": `
				'WAREHOUSE' = ANY(um.scope_type)
				AND um.scope_id = w.guid::text
        	`,
		},
	}

	users, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"u.login",
			"u.full_name",
			"u.email",
			"u.merchants_id",
			"m.name AS merchant_name",
			"u.role_id",
			"r.name AS role_name",
			"um.scope_id",
			"um.scope_type",
			"s.name AS shop_name",
			"w.name AS warehouse_name",
		},
		joins,
		filter,
		[]string{},
	)
	if err != nil {
		request.Logger.
			Err(err).
			Msg("failed to get users")

		return nil, err
	}

	return map[string]any{
		"users": users,
	}, nil
}

func CreateUser(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateUser function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	username := cast.ToString(data["username"])
	pass := cast.ToString(data["password"])
	merchantID := cast.ToString(data["merchants_id"])
	roleID := cast.ToString(data["role_id"])
	scopeType := cast.ToString(data["scope_type"])
	scopeID := cast.ToString(data["scope_id"])

	if username == "" {
		return nil, fmt.Errorf("username is required")
	}

	if pass == "" {
		return nil, fmt.Errorf("password is required")
	}

	if roleID == "" {
		return nil, fmt.Errorf("role_id is required")
	}

	// Get current user
	resp, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"u.merchants_id",
			"u.client_type_id",
			"r.name AS role_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role as r",
				"condition": "u.role_id = r.guid",
			},
		},
		fmt.Sprintf("u.guid = '%s'", request.UserId),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(resp) == 0 {
		return nil, fmt.Errorf("unauthorized")
	}

	curUser := resp[0]

	curUserRoleName := cast.ToString(curUser["role_name"])
	curUserMerchantID := cast.ToString(curUser["merchants_id"])
	clientTypeID := cast.ToString(curUser["client_type_id"])

	// Only Admin and Merchant can create users
	if curUserRoleName != "Admin" && curUserRoleName != "Merchant" {
		return nil, fmt.Errorf("permission denied")
	}

	if curUserRoleName == "Admin" {
		if merchantID == "" {
			return nil, fmt.Errorf("merchants_id is required")
		}
	} else {
		merchantID = curUserMerchantID
	}

	// Get target role
	roleResp, err := utils.SelectOneItem(
		request,
		"role",
		[]string{
			"guid",
			"name",
		},
		fmt.Sprintf("guid = '%s'", roleID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(roleResp) == 0 {
		return nil, fmt.Errorf("role not found")
	}

	targetRoleName := cast.ToString(roleResp["name"])

	// Check permission to create target role
	if curUserRoleName == "Merchant" {
		if targetRoleName != "Shop Manager" &&
			targetRoleName != "Warehouse Manager" {
			return nil, fmt.Errorf("permission denied")
		}
	}

	if curUserRoleName == "Admin" {
		if targetRoleName != "Merchant" &&
			targetRoleName != "Shop Manager" &&
			targetRoleName != "Warehouse Manager" {
			return nil, fmt.Errorf("permission denied")
		}
	}

	// Validate scope
	if targetRoleName == "Shop Manager" {
		if scopeType != "SHOP" || scopeID == "" {
			return nil, fmt.Errorf("shop manager requires a shop")
		}

		shop, err := utils.SelectOneItem(
			request,
			"shops",
			[]string{
				"guid",
			},
			fmt.Sprintf(
				"guid = '%s' AND merchants_id = '%s'",
				scopeID,
				merchantID,
			),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if len(shop) == 0 {
			return nil, fmt.Errorf("shop not found for this merchant")
		}
	}

	if targetRoleName == "Warehouse Manager" {
		if scopeType != "WAREHOUSE" || scopeID == "" {
			return nil, fmt.Errorf("warehouse manager requires a warehouse")
		}

		warehouse, err := utils.SelectOneItem(
			request,
			"warehouse",
			[]string{
				"guid",
			},
			fmt.Sprintf(
				"guid = '%s' AND merchants_id = '%s'",
				scopeID,
				merchantID,
			),
			[]string{},
		)
		if err != nil {
			return nil, err
		}

		if len(warehouse) == 0 {
			return nil, fmt.Errorf("warehouse not found for this merchant")
		}
	}

	guid := uuid.New().String()

	createData := map[string]any{
		"guid":           guid,
		"login":          username,
		"password":       pass,
		"client_type_id": clientTypeID,
		"role_id":        roleID,
		"merchants_id":   merchantID,
	}

	// Create user
	res, raw, err := request.UcodeSdk.
		Items("users").
		Create(createData).
		Exec()
	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create user")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// Create permission for scoped users
	if scopeType != "" && scopeID != "" {
		_, raw, err := request.UcodeSdk.
			Items("user_memberships").
			Create(
				map[string]any{
					"users_id":   guid,
					"scope_type": []string{scopeType},
					"scope_id":   scopeID,
				},
			).
			Exec()

		if err != nil {
			deleteErr := utils.DeleteItemsByIDs(
				request,
				"users",
				[]string{guid},
			)

			if deleteErr != nil {
				request.Logger.
					Err(deleteErr).
					Msg("failed to rollback created user")
			}

			request.Logger.
				Err(err).
				Interface("response", raw).
				Msg("failed to create user permission")

			return nil, utils.ExtractUcodeError(raw, err)
		}
	}

	return map[string]any{
		"message": "user created successfully",
		"data":    res.Data.Data.Data,
	}, nil
}

func UpdateProfile(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateProfile triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	userID := cast.ToString(data["user_id"])
	fullName := cast.ToString(data["full_name"])
	email := cast.ToString(data["email"])
	login := cast.ToString(data["login"])
	pass := cast.ToString(data["password"])

	if userID != request.UserId {
		return nil, fmt.Errorf("permission denied")
	}

	updateData := map[string]any{
		"guid": userID,
	}

	if fullName != "" {
		updateData["full_name"] = fullName
	}

	if email != "" {
		updateData["email"] = email
	}

	if login != "" {
		updateData["login"] = login
	}

	if pass != "" {
		updateData["password"] = pass
	}

	if len(updateData) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	res, raw, err := request.UcodeSdk.
		Items("users").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update profile")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	return map[string]any{
		"message": "profile updated successfully",
		"data":    res.Data.Data,
	}, nil
}

func DeleteUser(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteUser function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	userID := cast.ToString(data["user_id"])

	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}

	// User cannot delete himself
	if userID == request.UserId {
		return nil, fmt.Errorf("you cannot delete yourself")
	}

	// Get current user's role and merchant
	currentUser, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"u.merchants_id",
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

	if len(currentUser) == 0 {
		return nil, fmt.Errorf("current user not found")
	}

	currentRole := cast.ToString(currentUser[0]["role_name"])
	currentMerchantID := cast.ToString(currentUser[0]["merchants_id"])

	// Get target user
	targetUser, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"u.merchants_id",
			"r.name AS role_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "u.role_id = r.guid",
			},
		},
		fmt.Sprintf("u.guid = '%s'", userID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(targetUser) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	targetRole := cast.ToString(targetUser[0]["role_name"])
	targetMerchantID := cast.ToString(targetUser[0]["merchants_id"])

	// ADMIN can delete any user
	if currentRole == "Admin" {

		// allowed

	} else if currentRole == "Merchant" {

		// Merchant cannot delete ADMIN
		if targetRole == "Admin" {
			return nil, fmt.Errorf(
				"merchant cannot delete admin",
			)
		}

		// Merchant can delete only users from own merchant
		if currentMerchantID != targetMerchantID {
			return nil, fmt.Errorf(
				"you do not have permission to delete this user",
			)
		}

	} else {
		return nil, fmt.Errorf(
			"you do not have permission to delete users",
		)
	}

	resp, err := request.UcodeSdk.
		Items("users").
		Delete().
		Single(userID).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("failed to delete user")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	return map[string]any{
		"message": "user deleted successfully",
		"data":    resp.Data,
	}, nil
}