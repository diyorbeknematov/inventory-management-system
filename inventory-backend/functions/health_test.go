package helper

import (
	"function/models"
	"os"
	"testing"

	"github.com/rs/zerolog"
)

func TestHealthCheck(t *testing.T) {

	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

	request := &models.FunctionRequest{
		Logger: logger,
	}

	response, err := HealthCheck(request)
	if err != nil {
		t.Errorf("HealthCheck() returned error: %v", err)
	}

	if response == nil {
		t.Errorf("HealthCheck() returned nil response")
	}

	status, ok := response["status"]
	if !ok {
		t.Errorf("HealthCheck() response missing 'status' key")
	}

	if status != "healthy" {
		t.Errorf("HealthCheck() status = %v, want 'healthy'", status)
	}
}
