package redis

import (
	"context"
	"encoding/json"
	"errors"
	"function/models"
	"math/rand"
	"time"

	"github.com/redis/go-redis/v9"
)

var ErrCacheMiss = errors.New("cache miss")

func Set(
	request *models.FunctionRequest,
	key string,
	value any,
	expiration time.Duration,
) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return request.Params.CacheClient.Set(
		context.Background(),
		key,
		string(data),
		int(expiration.Seconds()),
	)
}

func Get(
	request *models.FunctionRequest,
	key string, 
	result any,
) error {
	data, err := request.Params.CacheClient.Get(
		context.Background(),
		key,
	)
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return ErrCacheMiss
		}
		return err
	}
	return json.Unmarshal([]byte(data), result)
}

func Delete(
	request *models.FunctionRequest,
	key string,
) error {
	return request.Params.CacheClient.Del(
		context.Background(),
		key,
	)
}

func DeleteWildCard(request *models.FunctionRequest, pattern string) error {
	return request.Params.CacheClient.DelWildCard(
		context.Background(),
		pattern,
	)
}

func WithJitter(base time.Duration) time.Duration {
	if base <= 0 {
		return base
	}
	return base + time.Duration(rand.Int63n(int64(base)/10))
}
