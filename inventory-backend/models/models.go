package models

import (
	"function/pkg"

	cache "github.com/golanguzb70/redis-cache"

	"github.com/rs/zerolog"
	sdk "github.com/ucode-io/ucode_sdk"
)

func NewParams(cfg *pkg.Config) *Params {
	var response = &Params{Config: cfg}

	if cfg.Redis.Enabled {
		cacheConfig := &cache.Config{
			RedisHost:     cfg.Redis.RedisHost,
			RedisPort:     cfg.Redis.RedisPort,
			RedisUsername: cfg.Redis.RedisUser,
			RedisPassword: cfg.Redis.RedisPass,
		}

		cacheClient, err := cache.New(cacheConfig)
		if err != nil {
			response.Log.Error().Msgf("Error creating cache client: %v", err)
			response.CacheAvailable = false
		} else {
			response.CacheClient = cacheClient
			response.CacheAvailable = true
		}

	}

	return response
}

type (
	Params struct {
		CacheClient    cache.RedisCache
		CacheAvailable bool
		Log            zerolog.Logger
		Config         *pkg.Config
	}
	NewRequestBody struct {
		Auth struct {
			Type string         `json:"type"`
			Data map[string]any `json:"data"`
		} `json:"auth"`
		Data struct {
			AppId         string         `json:"app_id"`
			EnvironmentId string         `json:"environment_id"`
			Method        string         `json:"method"`
			ObjectData    map[string]any `json:"object_data"`
			ProjectID     string         `json:"project_id"`
			Table         string         `json:"table_slug"`
			UserID        string         `json:"user_id"`
		} `json:"data"`
	}
	FunctionRequest struct {
		UcodeSdk      sdk.UcodeApis
		Logger        zerolog.Logger
		Data          map[string]any
		AppId         string
		EnvironmentId string
		ProjectId     string
		Params        *pkg.Params
		UserId        string
	}
	GetListAggregationClientApiResponse struct {
		Data struct {
			Data struct {
				Data []any `json:"data"`
			} `json:"data"`
		} `json:"data"`
	}
	HandlerFunc func(*FunctionRequest) (map[string]any, error)
)
