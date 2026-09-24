package utils

import (
	"function/models"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

type StockLocation struct {
	ID    string
	Table string
	Field string
}

type StockRollback struct {
	createdIDs []string
	updated    []map[string]any
}

// ----------------------------
// getIDs
// ----------------------------
func GetIDs(rows []map[string]any, field string) []string {
	ids := make([]string, 0, len(rows))
	seen := make(map[string]struct{})

	for _, row := range rows {
		id := cast.ToString(row[field])

		if _, ok := seen[id]; ok || id == "" {
			continue
		}

		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	return ids
}

func GetAnySlice(v any) []any {
	if v == nil {
		return nil
	}

	if k, ok := v.([]any); ok {
		return k
	}

	if k, ok := v.([]interface{}); ok {
		res := make([]any, len(k))
		copy(res, k)

		return res
	}

	return nil
}

func GetStringSlice(v any) []string {
	if v == nil {
		return nil
	}

	switch t := v.(type) {
	case []string:
		return t

	case []any:
		result := make([]string, 0, len(t))

		for _, item := range t {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}

		return result
	}

	return nil
}

func GetFirstString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case []string:
		if len(t) > 0 {
			return t[0]
		}
	case []any:
		if len(t) > 0 {
			if s, ok := t[0].(string); ok {
				return s
			}
		}
	}
	return ""
}

// -------------------------
// getSourceLocation
// -------------------------
func GetSourceLocation(
	sourceShopID string,
	sourceWarehouseID string,
) StockLocation {
	if sourceShopID != "" {
		return StockLocation{
			ID:    sourceShopID,
			Table: "shop_inventory",
			Field: "shops_id",
		}
	}

	if sourceWarehouseID != "" {
		return StockLocation{
			ID:    sourceWarehouseID,
			Table: "warehouse_stocks",
			Field: "warehouse_id",
		}
	}

	return StockLocation{}
}

// --------------------------
// getDestinationLocation
// --------------------------
func GetDestinationLocation(
	destinationShopID string,
	destinationWarehouseID string,
) StockLocation {
	if destinationShopID != "" {
		return StockLocation{
			ID:    destinationShopID,
			Table: "shop_inventory",
			Field: "shops_id",
		}
	}

	if destinationWarehouseID != "" {
		return StockLocation{
			ID:    destinationWarehouseID,
			Table: "warehouse_stocks",
			Field: "warehouse_id",
		}
	}

	return StockLocation{}
}

func BuildInClause(field string, ids []string) string {
	if len(ids) == 0 {
		return "1=0"
	}

	return field + " IN ('" + strings.Join(ids, "','") + "')"
}

func GroupBy(rows []map[string]any, field string) map[string][]map[string]any {
	result := make(map[string][]map[string]any)
	for _, row := range rows {
		key := cast.ToString(row[field])
		result[key] = append(result[key], row)
	}

	return result
}

// ---------------------------
// buildCategoryTree
// ---------------------------
func BuildCategoryTree(
	category map[string]any,
	subCategoriesByParent map[string][]map[string]any,
	productsByCategory map[string][]map[string]any,
) map[string]any {

	categoryID := cast.ToString(category["guid"])

	products := productsByCategory[categoryID]

	children := subCategoriesByParent[categoryID]

	subcategories := make([]map[string]any, 0, len(children))

	for _, child := range children {
		childTree := BuildCategoryTree(
			child,
			subCategoriesByParent,
			productsByCategory,
		)

		if childTree != nil {
			subcategories = append(subcategories, childTree)
		}
	}

	// Categoryda product ham yo'q,
	// childlarda ham product yo'q bo'lsa, chiqarmaymiz.
	if len(products) == 0 && len(subcategories) == 0 {
		return nil
	}

	return map[string]any{
		"guid":          category["guid"],
		"name":          category["name"],
		"description":   category["description"],
		"products":      products,
		"subcategories": subcategories,
	}
}

// -------------------------
// deleteItemsByIDs
// -------------------------
func DeleteItemsByIDs(
	request *models.FunctionRequest,
	tableSlug string,
	ids []string,
) error {

	resp, err := request.UcodeSdk.Items(tableSlug).
		Delete().
		Multiple(ids).
		Exec()
	if err != nil {
		return ExtractUcodeError(resp, err)
	}

	return nil
}

func GenerateProductCode() string {
	return "PRD-" + strings.ToUpper(uuid.New().String()[:8])
}

func GenerateSKU(productCode, color, size string) string {
	parts := []string{productCode}

	if color != "" {
		parts = append(parts, NormalizeSKUValue(color))
	}

	if size != "" {
		parts = append(parts, NormalizeSKUValue(size))
	}

	if len(parts) == 1 {
		parts = append(parts, "DEFAULT")
	}

	return strings.Join(parts, "-")
}

func NormalizeSKUValue(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ToUpper(value)
	value = strings.ReplaceAll(value, " ", "-")

	return value
}
