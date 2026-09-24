package utils

import (
	"errors"
	"fmt"
	"function/models"
	"strings"

	"github.com/spf13/cast"
)

type UserAccess struct {
	RoleID     string
	RoleName   string
	MerchantID string
	ScopeType  string
	ScopeID    string
}

// ----------------------------------
// checkMovementOwnership
// ----------------------------------
func CheckMovementOwnership(
	request *models.FunctionRequest,
	merchantID string,
	movementType string,
	sourceShopID string,
	sourceWarehouseID string,
	destShopID string,
	destWarehouseID string,
) error {

	switch movementType {

	case "RECEIPT":
		// external → warehouse
		return CheckWarehouseOwnership(
			request,
			destWarehouseID,
			merchantID,
		)

	case "SALE":
		// shop -> customer
		return CheckShopOwnership(
			request,
			sourceShopID,
			merchantID,
		)

	case "RETURN":
		// shop -> warehouse
		if err := CheckShopOwnership(
			request,
			sourceShopID,
			merchantID,
		); err != nil {
			return err
		}

		return CheckWarehouseOwnership(
			request,
			destWarehouseID,
			merchantID,
		)

	case "TRANSFER":
		// source -> destination

		if sourceWarehouseID != "" {
			if err := CheckWarehouseOwnership(
				request,
				sourceWarehouseID,
				merchantID,
			); err != nil {
				return err
			}
		}

		if sourceShopID != "" {
			if err := CheckShopOwnership(
				request,
				sourceShopID,
				merchantID,
			); err != nil {
				return err
			}
		}

		if destWarehouseID != "" {
			if err := CheckWarehouseOwnership(
				request,
				destWarehouseID,
				merchantID,
			); err != nil {
				return err
			}
		}

		if destShopID != "" {
			if err := CheckShopOwnership(
				request,
				destShopID,
				merchantID,
			); err != nil {
				return err
			}
		}

		return nil

	default:
		return fmt.Errorf("invalid movement type: %s", movementType)
	}
}

// ------------------------------
// checkShopOwnership
// ------------------------------
func CheckShopOwnership(
	request *models.FunctionRequest,
	shopID string,
	merchantID string,
) error {
	if shopID == "" {
		return errors.New("shop_id is required")
	}

	shop, err := SelectOneItem(
		request,
		"shops",
		[]string{"guid", "merchants_id"},
		fmt.Sprintf("guid = '%s'", shopID),
		[]string{},
	)
	if err != nil {
		return err
	}

	if shop == nil {
		return errors.New("shop not found")
	}

	shopMerchantID := cast.ToString(shop["merchants_id"])

	if shopMerchantID != merchantID {
		return errors.New("shop does not belong to merchant")
	}

	return nil
}

// -------------------------------
// checkWarehouseOwnership
// -------------------------------
func CheckWarehouseOwnership(
	request *models.FunctionRequest,
	warehouseID string,
	merchantID string,
) error {
	if warehouseID == "" {
		return errors.New("warehouse_id is required")
	}

	warehouse, err := SelectOneItem(
		request,
		"warehouse",
		[]string{"guid", "merchants_id"},
		fmt.Sprintf("guid = '%s'", warehouseID),
		[]string{},
	)
	if err != nil {
		return err
	}

	if warehouse == nil {
		return errors.New("warehouse not found")
	}

	warehouseMerchantID := cast.ToString(warehouse["merchants_id"])

	if warehouseMerchantID != merchantID {
		return errors.New("warehouse does not belong to merchant")
	}

	return nil
}

func CheckVariationInStock(
	request *models.FunctionRequest,
	variationIDs []string,
	location StockLocation,
) ([]string, error) {

	if len(variationIDs) == 0 {
		return []string{}, nil
	}

	ids := make([]string, 0, len(variationIDs))

	for _, id := range variationIDs {
		ids = append(ids, fmt.Sprintf("'%s'", id))
	}

	stocks, err := SelectItems(
		request,
		location.Table,
		[]string{"product_variations_id"},
		fmt.Sprintf(
			"%s = '%s' AND %s",
			location.Field,
			location.ID,
			BuildInClause(
				"product_variations_id",
				variationIDs,
			),
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	result := make([]string, 0, len(stocks))

	for _, stock := range stocks {
		result = append(
			result,
			cast.ToString(stock["product_variations_id"]),
		)
	}

	return result, nil
}

func GetUserAccess(request *models.FunctionRequest) (*UserAccess, error) {
	request.Logger.Info().Msg("GetUserAccess function triggered")

	if request.UserId == "" {
		return nil, fmt.Errorf("user id is required")
	}

	users, err := SelectJoin(
		request,
		"users u",
		[]string{
			"u.role_id",
			"r.name AS role_name",
			"u.merchants_id",
			"um.scope_type",
			"um.scope_id",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "r.guid = u.role_id",
			},
			{
				"type":      "LEFT",
				"table":     "user_memberships um",
				"condition": "um.users_id = u.guid",
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

	user := users[0]

	return &UserAccess{
		RoleID:     cast.ToString(user["role_id"]),
		RoleName:   cast.ToString(user["role_name"]),
		MerchantID: cast.ToString(user["merchants_id"]),
		ScopeType:  GetFirstString(user["scope_type"]),
		ScopeID:    cast.ToString(user["scope_id"]),
	}, nil
}

func CanManage(
	access *UserAccess,
	merchantID string,
) error {

	if access.RoleName == "Admin" {
		return nil
	}

	if access.RoleName == "Merchant" {
		if access.MerchantID != merchantID {
			return fmt.Errorf("you do not have permission to access this data")
		}

		return nil
	}

	return fmt.Errorf("permission denied")
}
