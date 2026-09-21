package pkg

import (
	"github.com/spf13/cast"
)

func ReturnCount(table, where, appId string) (int, error) {
	pipeline := map[string]any{
		"operation": "SELECT",
		"table":     table,
		"columns":   []string{"COUNT(*) AS total_count"},
		"where":     where,
	}

	response, err := DoRequestAggregation(map[string]any{"data": pipeline}, appId)
	if err != nil {
		return 0, err
	}

	var (
		respData   = response.Data.Data.Data
		totalCount int
	)

	if len(respData) > 0 {
		count, ok := respData[0]["total_count"]
		if ok {
			totalCount = cast.ToInt(count)
		}
	}

	return totalCount, nil
}
