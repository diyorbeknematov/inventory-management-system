package utils

import (
	"fmt"
	"function/models"
)

// -----------------------------
// SelectItems
// -----------------------------
func SelectItems(
	request *models.FunctionRequest,
	table string,
	columns []string,
	where string,
	groupBy []string,
) ([]map[string]any, error) {
	query := map[string]any{
		"operation": "SELECT",
		"table":     table,
		"columns":   columns,
		"where":     where,
		"order_by":  []string{"created_at DESC"},
	}

	if len(groupBy) > 0 {
		query["group_by"] = groupBy
	}

	resp, raw, err := request.UcodeSdk.Items(table).
		GetList().
		Pipelines(query).
		ExecAggregation()

	if err != nil {
		request.Logger.Err(err).Interface("raw_response", raw).Interface("query", query).
			Msg("ucodeSelect failed")
		return nil, ExtractUcodeError(raw, err)
	}

	return resp.Data.Data.Data, nil
}

// ---------------------------
// SelectOneItem
// ---------------------------
func SelectOneItem(
	request *models.FunctionRequest,
	table string,
	columns []string,
	where string,
	groupBy []string,
) (map[string]any, error) {
	query := map[string]any{
		"operation": "SELECT",
		"table":     table,
		"columns":   columns,
		"where":     where,
		"limit":     1,
		"offset":    0,
	}

	if len(groupBy) > 0 {
		query["group_by"] = groupBy
	}

	resp, raw, err := request.UcodeSdk.Items(table).
		GetList().
		Pipelines(query).
		ExecAggregation()

	if err != nil {
		request.Logger.Err(err).Interface("raw_response", raw).Interface("query", query).
			Msg("ucodeSelect failed")
		return nil, ExtractUcodeError(raw, err)
	}

	if len(resp.Data.Data.Data) == 0 {
		return nil, fmt.Errorf("not found any item")
	}

	return resp.Data.Data.Data[0], nil
}

func SelectJoin(
	request *models.FunctionRequest,
	table string,
	colums []string,
	joins []map[string]string,
	where string,
	groupBy []string,
) ([]map[string]any, error) {
	query := map[string]any{
		"operation": "SELECT",
		"table":     table,
		"columns":   colums,
		"joins":     joins,
		"where":     where,
	}

	if len(groupBy) > 0 {
		query["group_by"] = groupBy
	}

	resp, raw, err := request.UcodeSdk.Items(table).
		GetList().
		Pipelines(query).
		ExecAggregation()

	if err != nil {
		request.Logger.Err(err).Interface("raw_response", raw).Interface("query", query).
			Msg("ucodeSelect failed")
		return nil, ExtractUcodeError(raw, err)
	}

	return resp.Data.Data.Data, nil
}
