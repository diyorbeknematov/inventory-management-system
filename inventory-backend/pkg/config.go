package pkg

import (
	"fmt"
	"os"

	"github.com/ilyakaznacheev/cleanenv"
	"github.com/joho/godotenv"
	"github.com/spf13/cast"
)

type (
	Config struct {
		App   `yaml:"app"`
		Redis `yaml:"redis"`
	}

	// App -.
	App struct {
		Name     string `env-required:"false" yaml:"name"    env:"APP_NAME"`
		LogLevel string `env-required:"false" yaml:"log_level"    env:"LOG_LEVEL"`
	}

	// Redis -.
	Redis struct {
		RedisHost string `env:"GET_REQUEST_REDIS_HOST" yaml:"host" env-default:"localhost"`
		RedisPort int    `env:"GET_REQUEST_REDIS_PORT" yaml:"port" env-default:"6379"`
		RedisUser string `env:"GET_REQUEST_REDIS_USER" yaml:"user"`
		RedisPass string `env:"REDIS_PASS" yaml:"pass"`
		Enabled   bool   `env:"REDIS_ENABLED" yaml:"enabled" env-default:"true"`
	}
)

// NewConfig returns app config.
func NewConfig() (*Config, error) {
	cfg := &Config{}

	// Load environment variables from .env file
	err := godotenv.Load(".env")
	if err != nil {
		err := godotenv.Load("/app/.env")
		if err != nil {
			fmt.Printf("warning: error loading .env file: %v\n", err)
		}
	}

	// Populate values with defaults or environment variables
	cfg.App.Name = cast.ToString(getOrDefault("APP_NAME", ""))
	cfg.App.LogLevel = cast.ToString(getOrDefault("LOG_LEVEL", "info"))

	// Redis
	cfg.RedisHost = cast.ToString(getOrDefault("GET_REQUEST_REDIS_HOST", ""))
	cfg.RedisPort = cast.ToInt(getOrDefault("GET_REQUEST_REDIS_PORT", 6379))
	cfg.RedisUser = cast.ToString(getOrDefault("GET_REQUEST_REDIS_USER", ""))
	cfg.RedisPass = cast.ToString(getOrDefault("GET_REQUEST_REDIS_PASSWORD", ""))
	cfg.Enabled = cast.ToBool(getOrDefault("REDIS_ENABLED", false))

	// Use cleanenv for validation
	err = cleanenv.ReadEnv(cfg)
	if err != nil {
		return cfg, err
	}

	return cfg, nil
}

func getOrDefault(key string, def any) any {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	return val
}
