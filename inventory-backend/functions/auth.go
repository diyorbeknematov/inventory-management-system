package helper

import (
	"encoding/json"
	"fmt"
	"function/functions/utils"
	"function/models"
	"net/http"

	"github.com/spf13/cast"
)

func TestAuth(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().
		Str("user_id", request.UserId).
		Msg("authenticated user")

	fmt.Println(request.UcodeSdk.Auth())

	return map[string]any{
		"user_id": request.UserId,
	}, nil
}

func Login(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("Login function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	username := cast.ToString(data["username"])
	password := cast.ToString(data["password"])

	if username == "" || password == "" {
		return nil, fmt.Errorf("username or password cannot be empty")
	}

	// Get user with role
	res, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"u.guid",
			"u.role_id",
			"u.client_type_id",
			"u.merchants_id",
			"r.name AS role_name",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role as r",
				"condition": "u.role_id = r.guid",
			},
		},
		fmt.Sprintf("u.login = '%s'", username),
		[]string{},
	)
	if err != nil {
		request.Logger.
			Err(err).
			Msg("failed to get user")

		return nil, fmt.Errorf("username or password incorrect")
	}

	if len(res) == 0 {
		return nil, fmt.Errorf("username or password incorrect")
	}

	currUser := res[0]

	userID := cast.ToString(currUser["guid"])
	roleID := cast.ToString(currUser["role_id"])
	clientTypeID := cast.ToString(currUser["client_type_id"])
	roleName := cast.ToString(currUser["role_name"])
	merchantID := cast.ToString(currUser["merchants_id"])

	// Get permission for managers
	// Get membership for managers
	membership := map[string]any{}

	if roleName == "Shop Manager" || roleName == "Warehouse Manager" {
		membership, err = utils.SelectOneItem(
			request,
			"user_memberships",
			[]string{
				"guid",
				"scope_type",
				"scope_id",
			},
			fmt.Sprintf("users_id = '%s'", userID),
			[]string{},
		)
		if err != nil {
			request.Logger.
				Err(err).
				Msg("failed to get user membership")

			return nil, err
		}

		if len(membership) == 0 {
			return nil, fmt.Errorf("user membership not found")
		}
	}

	// Login to U-Code Auth
	body := map[string]any{
		"data": map[string]any{
			"username":       username,
			"password":       password,
			"role_id":        roleID,
			"client_type_id": clientTypeID,
		},
		"login_strategy": "LOGIN",
	}

	headers := map[string]string{
		"Content-Type":   "application/json",
		"X-API-KEY":      request.AppId,
		"Authorization":  "API-KEY",
		"Environment-Id": request.EnvironmentId,
	}

	respBody, err := request.UcodeSdk.DoRequest(
		fmt.Sprintf(
			"https://api.auth.u-code.io/v2/login/with-option?project-id=%s",
			request.ProjectId,
		),
		http.MethodPost,
		body,
		headers,
	)
	if err != nil {
		request.Logger.
			Err(err).
			Msg("failed to login user")

		return nil, err
	}

	resp := make(map[string]any)

	if err := json.Unmarshal(respBody, &resp); err != nil {
		request.Logger.
			Err(err).
			Msg("failed to unmarshal login response")

		return nil, err
	}

	status := cast.ToString(resp["status"])

	if status != "CREATED" {
		return nil, fmt.Errorf("username or password incorrect")
	}

	respData := cast.ToStringMap(resp["data"])

	if respData == nil {
		return nil, fmt.Errorf("invalid login response: data is missing")
	}

	var shopID string
	var warehouseID string

	if len(membership) > 0 {
		scopeType := utils.GetFirstString(membership["scope_type"])
		scopeID := cast.ToString(membership["scope_id"])

		if scopeType == "SHOP" {
			shopID = scopeID
		}

		if scopeType == "WAREHOUSE" {
			warehouseID = scopeID
		}
	}

	userData := cast.ToStringMap(respData["user_data"])

	if userData == nil {
		return nil, fmt.Errorf("invalid login response: user_data is missing")
	}

	cleanUserData := map[string]any{
		"user_id":        userID,
		"login":          userData["login"],
		"full_name":      userData["full_name"],
		"email":          userData["email"],
		"merchants_id":   merchantID,
		"role_id":        roleID,
		"role_name":      roleName,
		"client_type_id": clientTypeID,
		"shop_id":        shopID,
		"warehouse_id":   warehouseID,
	}

	token := cast.ToStringMap(respData["token"])

	if token == nil {
		return nil, fmt.Errorf("invalid login response: token is missing")
	}

	cleanToken := map[string]any{
		"access_token":  token["access_token"],
		"refresh_token": token["refresh_token"],
		"expires_at":    token["expires_at"],
	}

	return map[string]any{
		"data": map[string]any{
			"user_data": cleanUserData,
			"token":     cleanToken,
		},
	}, nil
}
