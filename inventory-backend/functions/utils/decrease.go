package utils

import (
	"fmt"
	"function/models"

	"github.com/spf13/cast"
)

type StockChange struct {
	Guid             string
	VariationID      string
	ProductName      string
	OldQuantity      int
	RequiredQuantity int
}

// -----------------------
// decrease stock
// -----------------------
func DecreaseStock(request *models.FunctionRequest, tableSlug string, stocks []StockChange) error {
	request.Logger.Info().Msg("decreaseStock function called")
	updateData := make([]map[string]any, 0)
	for _, stock := range stocks {
		updateData = append(updateData, map[string]any{
			"guid":     stock.Guid,
			"quantity": stock.OldQuantity - stock.RequiredQuantity,
		})
	}
	_, resp, err := request.UcodeSdk.Items(tableSlug).
		Update(map[string]any{"objects": updateData}).
		DisableFaas(true).
		ExecMultiple()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("error updating source stock")

		return ExtractUcodeError(resp, err)
	}

	return nil
}

// --------------------------
// getStockChanges
// --------------------------
func GetStockChanges(
	request *models.FunctionRequest,
	stockMovementID string,
) ([]StockChange, error) {
	request.Logger.Info().Msg("getStockChanges function called")

	items, resp, err := request.UcodeSdk.Items("stock_movement_items").
		GetList().
		Page(1).
		Limit(1000).
		Filter(map[string]any{
			"stock_movements_id": stockMovementID,
		}).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("error while fetching stock movement items")

		return nil, ExtractUcodeError(resp, err)
	}

	if len(items.Data.Data.Response) == 0 {
		return nil, fmt.Errorf(
			"there is no any item in the stock movement",
		)
	}

	result := make([]StockChange, 0, len(items.Data.Data.Response))
	seen := make(map[string]struct{})

	for _, item := range items.Data.Data.Response {
		variationID := cast.ToString(item["product_variations_id"])
		requiredQuantity := cast.ToInt(item["quantity"])

		if _, exists := seen[variationID]; exists {
			return nil, fmt.Errorf(
				"duplicate product variation ID: %s",
				variationID,
			)
		}

		seen[variationID] = struct{}{}

		variation, err := SelectJoin(
			request,
			"product_variations pv",
			[]string{
				"p.name",
				"pv.sku",
			},
			[]map[string]string{
				{
					"type":      "INNER",
					"table":     "products p",
					"condition": "pv.products_id = p.guid",
				},
			},
			fmt.Sprintf("pv.guid = '%s'", variationID),
			[]string{},
		)

		if err != nil {
			return nil, err
		}

		if len(variation) == 0 {
			return nil, fmt.Errorf("the product variation not found")
		}

		productName := cast.ToString(variation[0]["name"])
		sku := cast.ToString(variation[0]["sku"])

		result = append(result, StockChange{
			VariationID:      variationID,
			RequiredQuantity: requiredQuantity,
			ProductName:      fmt.Sprintf("%s (SKU: %s)", productName, sku),
		})
	}

	return result, nil
}
