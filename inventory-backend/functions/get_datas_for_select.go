package helper

import (
	"fmt"
	"function/functions/utils"
	"function/models"
	"strings"

	"github.com/spf13/cast"
)

func GetMerchantsForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetMerchantsForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchants, err := utils.SelectItems(
		request,
		"merchants",
		[]string{
			"guid",
			"name",
		},
		"1=1",
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

func GetRolesForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetRolesForSelect triggered")

	roles, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
			"r.name",
			"r.guid",
		},
		[]map[string]string{
			{
				"type":      "INNER",
				"table":     "role r",
				"condition": "u.client_type_id = r.client_type_id",
			},
		},
		fmt.Sprintf(
			"u.guid = '%s'",
			request.UserId,
		),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"roles": roles,
	}, nil
}

func GetShopsForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetShopsForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	shopID := cast.ToString(data["shop_id"])

	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	shopFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	if shopID != "" {
		shopFilter += fmt.Sprintf(" AND guid = '%s'", strings.ReplaceAll(shopID, "'", "''"))
	}

	// Shops
	shops, err := utils.SelectItems(
		request,
		"shops",
		[]string{
			"guid",
			"name",
		},
		shopFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"shops": shops,
	}, nil
}

func GetWarehousesForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetWarehousesForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])

	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	warehouseFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	// Warehuses
	warehouses, err := utils.SelectItems(
		request,
		"warehouse",
		[]string{"guid", "name"},
		warehouseFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"warehouses": warehouses,
	}, nil
}

func GetProductsForSelect(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetProductsForSelect triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	merchantID := cast.ToString(data["merchants_id"])
	if err := validateMerchantAccess(request, merchantID); err != nil {
		return nil, err
	}

	productFilter := fmt.Sprintf(
		"merchants_id = '%s'",
		strings.ReplaceAll(merchantID, "'", "''"),
	)

	// products and product variations
	products, err := utils.SelectItems(
		request,
		"products",
		[]string{
			"guid",
			"name",
			"category_id",
		},
		productFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	productIDs := utils.GetIDs(products, "guid")

	variations, err := utils.SelectItems(
		request,
		"product_variations",
		[]string{
			"guid",
			"products_id",
			"sku",
			"size",
			"color",
		},
		utils.BuildInClause("products_id", productIDs),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	variationsByProduct := utils.GroupBy(variations, "products_id")

	for _, p := range products {
		pID := cast.ToString(p["guid"])
		p["variations"] = variationsByProduct[pID]
	}

	return map[string]any{
		"products": products,
	}, nil
}

func validateMerchantAccess(
	request *models.FunctionRequest,
	merchantID string,
) error {
	if merchantID == "" {
		return fmt.Errorf("merchants_id is required")
	}

	user, err := utils.SelectJoin(
		request,
		"users u",
		[]string{
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
		return err
	}

	if len(user) == 0 {
		return fmt.Errorf("user not found")
	}

	roleName := cast.ToString(user[0]["role_name"])

	if roleName == "Admin" {
		return nil
	}

	userMerchantID := cast.ToString(user[0]["merchants_id"])

	if userMerchantID == "" {
		return fmt.Errorf("merchant_id not found for user")
	}

	if userMerchantID != merchantID {
		return fmt.Errorf("you do not have access to this merchant")
	}

	return nil
}
