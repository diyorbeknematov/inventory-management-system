package pkg

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	sdk "github.com/ucode-io/ucode_sdk"
)

func DoRequest(url string, method string, body any, headers map[string]string) (*http.Response, error) {
	var (
		client = &http.Client{
			Timeout: 30 * time.Second,
		}
		req *http.Request
		err error
	)

	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("error marshaling body: %w", err)
		}
		req, err = http.NewRequest(method, url, bytes.NewBuffer(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("error creating request: %w", err)
		}
	} else {
		req, err = http.NewRequest(method, url, nil)
		if err != nil {
			return nil, fmt.Errorf("error creating request: %w", err)
		}
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return client.Do(req)
}

func DoRequestAggregation(body map[string]any, apiKey string) (*sdk.GetListAggregationClientApiResponse, error) {
	var response sdk.GetListAggregationClientApiResponse

	data, err := json.Marshal(&body)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Timeout: time.Duration(time.Second * 30),
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.admin.u-code.io/v2/items/1/aggregation", bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "API-KEY")
	req.Header.Add("X-API-KEY", apiKey)
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respByte, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if err = json.Unmarshal(respByte, &response); err != nil {
		return nil, err
	}

	return &response, nil
}
