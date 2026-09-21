package utils

import (
	"fmt"
	"function/models"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

// ---------------------------
// increase stock
// ---------------------------
func IncreaseStock(
	request *models.FunctionRequest,
	destinationID string,
	tableSlug string,
	fieldSlug string,
	stocks []StockChange,
) error {
	request.Logger.Info().Msg("increaseDestStock function called")

	variationIDs := make([]string, 0, len(stocks))

	for _, stock := range stocks {
		variationIDs = append(variationIDs, stock.VariationID)
	}

	inventories, resp, err := request.UcodeSdk.Items(tableSlug).
		GetList().
		Page(1).
		Limit(1000).
		Filter(map[string]any{
			fieldSlug: destinationID,
			"product_variations_id": map[string]any{
				"$in": variationIDs,
			},
		}).
		Exec()

	if err != nil {
		request.Logger.Err(err).
			Interface("response", resp).
			Msg("error while fetching destination inventory")

		return ExtractUcodeError(resp, err)
	}

	inventoryMap := make(map[string]map[string]any)

	for _, inventory := range inventories.Data.Data.Response {
		variationID := cast.ToString(inventory["product_variations_id"])

		inventoryMap[variationID] = inventory
	}

	updateData := make([]map[string]any, 0)
	createDatas := make([]map[string]any, 0)

	rollback := StockRollback{
		createdIDs: make([]string, 0),
		updated:    make([]map[string]any, 0),
	}

	for _, stock := range stocks {
		inventory, exists := inventoryMap[stock.VariationID]

		if exists {
			// if exists
			oldQuantity := cast.ToInt(inventory["quantity"])
			guid := cast.ToString(inventory["guid"])

			// UPDATE xato bo'lsa shu eski qiymatga qaytaramiz.
			rollback.updated = append(
				rollback.updated,
				map[string]any{
					"guid":     guid,
					"quantity": oldQuantity,
				},
			)

			updateData = append(
				updateData,
				map[string]any{
					"guid":     guid,
					"quantity": oldQuantity + stock.RequiredQuantity,
				},
			)

			continue
		}

		guid := uuid.New().String()

		createDatas = append(
			createDatas,
			map[string]any{
				"guid":                  guid,
				fieldSlug:               destinationID,
				"product_variations_id": stock.VariationID,
				"quantity":              stock.RequiredQuantity,
			},
		)

	}

	// 1. CREATE

	for _, data := range createDatas {
		_, _, err := request.UcodeSdk.
			Items(tableSlug).
			Create(data).
			DisableFaas(true).
			Exec()

		if err != nil {
			request.Logger.Err(err).
				Msg("error creating destination stock")

			// Shu vaqtgacha muvaffaqiyatli
			// yaratilgan CREATE'larni o'chiramiz.
			if len(rollback.createdIDs) > 0 {
				deleteErr := DeleteItemsByIDs(
					request,
					tableSlug,
					rollback.createdIDs,
				)
				if deleteErr != nil {
					request.Logger.Err(deleteErr).
						Msg("CRITICAL: failed to rollback created destination stocks")
				}
			}

			return ExtractUcodeError(resp, err)
		}

		// Faqat CREATE muvaffaqiyatli bo'lgandan keyin
		// rollback ro'yxatiga qo'shish.
		guid := cast.ToString(data["guid"])

		rollback.createdIDs = append(
			rollback.createdIDs,
			guid,
		)
	}

	// 2. UPDATE

	if len(updateData) > 0 {
		_, resp, err = request.UcodeSdk.
			Items(tableSlug).
			Update(map[string]any{
				"objects": updateData,
			}).
			DisableFaas(true).
			ExecMultiple()

		if err != nil {
			request.Logger.Err(err).
				Interface("response", resp).
				Msg("error updating destination stock")

			// ---------------------------------------------
			// UPDATE rollback
			// ---------------------------------------------

			if len(rollback.updated) > 0 {
				_, restoreResp, restoreErr := request.UcodeSdk.
					Items(tableSlug).
					Update(map[string]any{
						"objects": rollback.updated,
					}).
					DisableFaas(true).
					ExecMultiple()

				if restoreErr != nil {
					request.Logger.Err(restoreErr).
						Interface("response", restoreResp).
						Msg("CRITICAL: failed to rollback updated destination stocks")
				}
			}

			// ---------------------------------------------
			// CREATE rollback
			// ---------------------------------------------

			if len(rollback.createdIDs) > 0 {
				deleteErr := DeleteItemsByIDs(
					request,
					tableSlug,
					rollback.createdIDs,
				)
				if deleteErr != nil {
					request.Logger.Err(deleteErr).
						Msg("CRITICAL: failed to rollback created destination stocks")
				}
			}

			return fmt.Errorf(
				"error updating destination stock: %w",
				err,
			)
		}
	}

	return nil
}


