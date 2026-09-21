package utils

import (
	"errors"
	"fmt"
	"function/models"

	"github.com/spf13/cast"
)

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
	variationID string,
	location StockLocation,
) (bool, error) {

	stocks, err := SelectItems(
		request,
		location.Table,
		[]string{"guid"},
		fmt.Sprintf(
			"%s = '%s' AND product_variations_id = '%s'",
			location.Field,
			location.ID,
			variationID,
		),
		[]string{},
	)
	if err != nil {
		return false, err
	}

	return len(stocks) > 0, nil
}

func CheckMerchantAccess(
	request *models.FunctionRequest,
	merchantID string,
) error {
	request.Logger.Info().Msg("CheckMerchantAccess function triggered")

	if merchantID == "" {
		return fmt.Errorf("merchant_id is required")
	}

	users, err := SelectJoin(
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
		return err
	}

	if len(users) == 0 {
		return fmt.Errorf("user not found")
	}

	user := users[0]

	roleName := cast.ToString(user["role_name"])
	// Admin can access any merchant
	if roleName == "Admin" {
		return nil
	}

	// Merchant can access only own merchant
	if roleName == "Merchant" {
		userMerchantID := cast.ToString(user["merchants_id"])

		if userMerchantID != merchantID {
			return fmt.Errorf("you do not have permission to access this data")
		}

		return nil
	}

	return fmt.Errorf("you do not have permission to access this data")
}
