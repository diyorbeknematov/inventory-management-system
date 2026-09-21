package helper

import (
	"function/models"
	"time"
)

func HealthCheck(request *models.FunctionRequest) (map[string]any, error) {
	response := make(map[string]any)

	response["status"] = "healthy"

	request.Logger.Info().Msg("Health check successful: " + time.Now().Format(time.RFC3339))
	return response, nil
}


