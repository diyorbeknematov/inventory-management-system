package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"

	"function"
	"function/pkg"

	"github.com/rs/zerolog"
)

func main() {

	file, err := os.Open("request.json")
	if err != nil {
		fmt.Printf("error opening file: %v", err.Error())
	}
	defer file.Close()

	var requestBody map[string]any
	err = json.NewDecoder(file).Decode(&requestBody)
	if err != nil {
		fmt.Printf("error decoding JSON: %v", err.Error())
	}

	// Marshal the request body
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		return
	}

	// Create a response recorder
	rr := httptest.NewRecorder()
	cfg, _ := pkg.NewConfig()

	// Set the Redis to enabled for testing
	cfg.Redis.Enabled = true

	// Create the handler params
	params := pkg.NewParams(cfg)
	params.Log = zerolog.New(zerolog.ConsoleWriter{Out: rr.Body}).With().Timestamp().Logger()

	// Create the request
	req, err := http.NewRequest("POST", "/test", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Println("Error creating request:", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	// Call the handler directly
	handler := function.Handler(params)
	handler(rr, req)

	// Print the response
	fmt.Printf("Status: %d\n", rr.Code)
	fmt.Printf("Body: %s\n", rr.Body.String())
}
