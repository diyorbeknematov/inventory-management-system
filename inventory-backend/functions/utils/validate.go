package utils

import (
	"fmt"

	"github.com/spf13/cast"
)

// ------------------------
// validateStockMovement
// ------------------------
func ValidateStockMovement(
	sourceShopID,
	destinationShopID,
	sourceWarehouseID,
	destinationWarehouseID,
	movementType string,
) error {
	switch {
	case sourceShopID != "" && sourceWarehouseID != "":
		return fmt.Errorf("only one source is allowed")

	case destinationShopID != "" && destinationWarehouseID != "":
		return fmt.Errorf("only one destination is allowed")

	case sourceShopID != "" && sourceShopID == destinationShopID:
		return fmt.Errorf("source and destination shop cannot be the same")

	case sourceWarehouseID != "" && sourceWarehouseID == destinationWarehouseID:
		return fmt.Errorf("source and destination warehouse cannot be the same")
	}

	source := sourceShopID != "" || sourceWarehouseID != ""
	destination := destinationShopID != "" || destinationWarehouseID != ""

	switch movementType {
	case "RECEIPT":
		if source || destinationWarehouseID == "" {
			return fmt.Errorf("invalid receipt")
		}

	case "TRANSFER":
		if !source || !destination {
			return fmt.Errorf("invalid transfer")
		}

	case "RETURN":
		if sourceShopID == "" || destinationWarehouseID == "" {
			return fmt.Errorf("invalid return")
		}

	case "SALE":
		if sourceShopID == "" || destination {
			return fmt.Errorf("invalid sale")
		}

	default:
		return fmt.Errorf("invalid movement type")
	}

	return nil
}

// -------------------------------
// validateStockMovementItems
// -------------------------------
func ValidateStockMovementItems(
	rowItems []any,
) error {
	seenVariations := make(map[string]bool)

	for i, rawItem := range rowItems {
		item, ok := rawItem.(map[string]any)
		if !ok {
			return fmt.Errorf("item %d is invalid", i+1)
		}

		variationID := cast.ToString(item["product_variations_id"])
		if variationID == "" {
			return fmt.Errorf(
				"item %d: product_variations_id is required",
				i+1,
			)
		}

		if seenVariations[variationID] {
			return fmt.Errorf(
				"item %d: product variation already exists in this movement",
				i+1,
			)
		}

		seenVariations[variationID] = true

		quantity := cast.ToFloat64(item["quantity"])
		if quantity <= 0 {
			return fmt.Errorf(
				"item %d: quantity must be greater than 0",
				i+1,
			)
		}
	}

	return nil
}
