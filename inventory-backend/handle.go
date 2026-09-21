package function

import (
	"encoding/json"
	"fmt"
	"function/functions"
	"function/models"
	"function/pkg"
	"io"
	"net/http"
	"time"

	sdk "github.com/ucode-io/ucode_sdk"
)

var (
	appId          = "P-n5hHJwLiO7rfVyrFyfj5JFnMDY5BduOc"
	functionName   = "diyorbek-inventory"
	baseUrl        = "https://api.admin.u-code.io"
	projectId      = "fe8c7b71-e71e-4fd0-a41a-c5282ab75a25"
	environmentId  = "52bc28b7-1afa-4871-b7b1-b1389b64ee80"
	requestTimeout = 30 * time.Second
)

func Handler(params *pkg.Params) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var (
			ucodeApi = sdk.New(&sdk.Config{
				BaseURL:        baseUrl,
				FunctionName:   functionName,
				RequestTimeout: requestTimeout,
			})

			userID   string
			request  models.NewRequestBody
			response sdk.Response
		)

		{
			requestByte, err := io.ReadAll(r.Body)
			if err != nil {
				handleResponse(w, returnError("error when getting request", err.Error()), http.StatusBadRequest)
				return
			}

			if err = json.Unmarshal(requestByte, &request); err != nil {
				handleResponse(w, returnError("error when unmarshl request", err.Error()), http.StatusInternalServerError)
				return
			}
			fmt.Println(string(requestByte))
		}

		userID = request.Data.UserID
		ucodeApi.Config().AppId = request.Data.AppId

		if handler, ok := helper.Handlers[request.Data.Method]; ok {
			responseData, err := handler(&models.FunctionRequest{
				UcodeSdk:      ucodeApi,
				AppId:         request.Data.AppId,
				EnvironmentId: request.Data.EnvironmentId,
				ProjectId:     request.Data.ProjectID,
				Data:          request.Data.ObjectData,
				Logger:        params.Log,
				Params:        params,
				UserId:        userID,
			})
			if err != nil {
				handleResponse(w, returnError(err.Error(), err.Error()), http.StatusInternalServerError)
				fmt.Println("\n\n", "Error", err)
				return
			}
			response.Status = "success"
			response.Data = responseData
			handleResponse(w, response, 200)
			return
		}

		response.Status = "error"
		response.Data = map[string]any{"message": "error", "error": "error"}
		handleResponse(w, response, 200)
	}
}

func returnError(clientError string, errorMessage string) any {
	return sdk.Response{
		Status: "error",
		Data:   map[string]any{"message": clientError, "error": errorMessage},
	}
}

func handleResponse(w http.ResponseWriter, body any, statusCode int) {
	w.Header().Set("Content-Type", "application/json")

	bodyByte, err := json.Marshal(body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`
			{
				"error": "Error marshalling response"
			}
		`))
		return
	}

	w.WriteHeader(statusCode)
	w.Write(bodyByte)
}
