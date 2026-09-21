package utils

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cast"
	ucodesdk "github.com/ucode-io/ucode_sdk"
)

func ExtractUcodeError(
	raw ucodesdk.Response,
	fallback error,
) error {
	description := cast.ToString(raw.Data["description"])

	if description == "" {
		return fallback
	}

	var descriptionData map[string]any

	if err := json.Unmarshal(
		[]byte(description),
		&descriptionData,
	); err != nil {
		return fallback
	}

	message := cast.ToString(descriptionData["data"])

	if message == "" {
		return fallback
	}

	return fmt.Errorf("%s", message)
}
