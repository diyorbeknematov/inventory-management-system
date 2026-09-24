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

// GetUsers
func GetUsers(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetUsers triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	search := cast.ToString(data["search"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if access.RoleName != "Admin" && access.RoleName != "Merchant" {
		return nil, fmt.Errorf(
			"you do not have permission to view users",
		)
	}

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("users:list:%s:%s",
		access.MerchantID,
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

	if access.RoleName == "Merchant" {
		if access.MerchantID == "" {
			return nil, fmt.Errorf(
				"merchant access is not configured",
			)
		}

		merchantID := strings.ReplaceAll(access.MerchantID, "'", "''")

		filter = fmt.Sprintf(
			"u.merchants_id = '%s'",
			merchantID,
		)
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		filter += fmt.Sprintf(
			" AND ("+
				"u.login ILIKE '%%%s%%' OR "+
				"u.full_name ILIKE '%%%s%%'"+
				")",
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

	res := map[string]any{
		"users": users,
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

// Create User
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

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if access.RoleName != "Admin" &&
		access.RoleName != "Merchant" {
		return nil, fmt.Errorf("permission denied")
	}

	if access.RoleName == "Admin" {
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
	roleID = strings.ReplaceAll(roleID, "'", "''")

	role, err := utils.SelectOneItem(
		request,
		"role",
		[]string{
			"guid",
			"name",
			"client_type_id",
		},
		fmt.Sprintf(
			"guid = '%s'",
			roleID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if role == nil {
		return nil, fmt.Errorf("role not found")
	}

	targetRoleName := cast.ToString(role["name"])
	clientTypeID := cast.ToString(role["client_type_id"])

	if clientTypeID == "" {
		return nil, fmt.Errorf("role client type is missing")
	}

	// Merchant can create only managers.
	if access.RoleName == "Merchant" &&
		targetRoleName != "Shop Manager" &&
		targetRoleName != "Warehouse Manager" {
		return nil, fmt.Errorf("permission denied")
	}

	if targetRoleName == "Merchant" ||
		targetRoleName == "Admin" {

		if scopeType != "" || scopeID != "" {
			return nil, fmt.Errorf(
				"%s user does not require a scope",
				targetRoleName,
			)
		}
	}

	if targetRoleName == "Shop Manager" {
		if scopeType != "SHOP" || scopeID == "" {
			return nil, fmt.Errorf(
				"shop manager requires a shop",
			)
		}

		scopeID = strings.ReplaceAll(scopeID, "'", "''")

		shop, err := utils.SelectOneItem(
			request,
			"shops",
			[]string{"guid"},
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

		if shop == nil {
			return nil, fmt.Errorf(
				"shop not found for this merchant",
			)
		}
	}

	// Admin user does not belong to a merchant.
	if targetRoleName == "Admin" {
		merchantID = ""
	}

	guid := uuid.New().String()

	createData := map[string]any{
		"guid":           guid,
		"login":          username,
		"password":       pass,
		"client_type_id": clientTypeID,
		"role_id":        roleID,
	}

	if merchantID != "" {
		createData["merchants_id"] = merchantID
	}

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

	// Create membership only for scoped users.
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

			return nil, utils.ExtractUcodeError(
				raw,
				err,
			)
		}
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateUsersCache(request, merchantID)

	return map[string]any{
		"message": "user created successfully",
		"data":    res.Data.Data.Data,
	}, nil
}

// Update Profile
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

	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}

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

	// guid itself is not an update field.
	if len(updateData) == 1 {
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

	// ---------------------------  Cleare Cache -----------------------
	if err := redis.DeleteWildCard(request, "users:list:*"); err != nil {
		request.Logger.Error().
			Err(err).
			Msg("cache invalidation failed")
	}

	return map[string]any{
		"message": "profile updated successfully",
		"data":    res.Data.Data,
	}, nil
}

// DeleteUser
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

	if userID == request.UserId {
		return nil, fmt.Errorf(
			"you cannot delete yourself",
		)
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	// Only Admin and Merchant can delete users.
	if access.RoleName != "Admin" &&
		access.RoleName != "Merchant" {
		return nil, fmt.Errorf(
			"you do not have permission to delete users",
		)
	}

	userID = strings.ReplaceAll(userID, "'", "''")

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
				"condition": "r.guid = u.role_id",
			},
		},
		fmt.Sprintf(
			"u.guid = '%s'",
			userID,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(targetUser) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	user := targetUser[0]

	targetMerchantID := cast.ToString(
		user["merchants_id"],
	)

	targetRoleName := cast.ToString(
		user["role_name"],
	)

	// Merchant cannot delete Admin.
	if access.RoleName == "Merchant" &&
		targetRoleName == "Admin" {
		return nil, fmt.Errorf(
			"merchant cannot delete admin",
		)
	}

	if targetMerchantID == "" {
		if access.RoleName != "Admin" {
			return nil, fmt.Errorf(
				"you do not have permission to delete this user",
			)
		}
	} else {
		if err := utils.CanManage(
			access,
			targetMerchantID,
		); err != nil {
			return nil, err
		}
	}

	resp, err := request.UcodeSdk.
		Items("users").
		Delete().
		Single(userID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete user")

		return nil, utils.ExtractUcodeError(
			resp,
			err,
		)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateUsersCache(request, access.MerchantID)

	return map[string]any{
		"message": "user deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateUsersCache(request *models.FunctionRequest, merchantID string) {
	patterns := []string{
		fmt.Sprintf("users:list:%s:*", merchantID), // shu merchant
		"users:list::*", // Admin "hammasi" ro'yxati
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
