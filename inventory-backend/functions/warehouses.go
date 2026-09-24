package helper

import (
	"errors"
	"fmt"
	"function/functions/redis"
	"function/functions/utils"
	"function/models"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cast"
)

// -------------------------------
// GetMerchantWarehouses
// -------------------------------
func GetWarehouses(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("GetWarehouses triggered")

	data := request.Data
	if data == nil {
		data = map[string]any{}
	}

	search := cast.ToString(data["search"])
	merchantID := cast.ToString(data["merchants_id"])

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if access.RoleName != "Admin" {
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf("merchant access is not configured")
		}
	}

	// ------------ Cache -----------------------------------------
	cacheKey := fmt.Sprintf("warehouses:list:%s:%s",
		merchantID,
		request.Params.CacheClient.Hash(search),
	)

	var cached map[string]any

	err = redis.Get(request, cacheKey, &cached)
	if err == nil {
		return cached, nil // cache hit
	}

	if !errors.Is(err, redis.ErrCacheMiss) {
		request.Logger.Err(err).Msg("redis get failed")
	}

	// --------------------------------------------------------------

	warehouseFilter := "1=1"

	if merchantID != "" {
		merchantID = strings.ReplaceAll(
			merchantID,
			"'",
			"''",
		)

		warehouseFilter += fmt.Sprintf(
			" AND w.merchants_id = '%s'",
			merchantID,
		)
	}

	if search != "" {
		search = strings.ReplaceAll(search, "'", "''")

		warehouseFilter += fmt.Sprintf(
			" AND w.name ILIKE '%%%s%%'",
			search,
		)
	}

	warehouses, err := utils.SelectItems(
		request,
		"warehouse w",
		[]string{
			"w.guid",
			"w.name",
			"w.address",
			"w.merchants_id",
		},
		warehouseFilter,
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	res := map[string]any{
		"warehouses": warehouses,
	}

	// --------------------------- Cache Set -----------------
	if err := redis.Set(
		request,
		cacheKey,
		res,
		redis.WithJitter(5*time.Minute),
	); err != nil {
		request.Logger.
			Err(err).
			Interface("data", res).
			Msg("redis set failed")
	}

	return res, nil
}

// Create Warehouse
func CreateWarehouse(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("CreateWarehouse triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	name := cast.ToString(data["name"])
	address := cast.ToString(data["address"])

	if name == "" {
		return nil, fmt.Errorf("warehouse name is required")
	}

	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	var merchantID string

	if access.RoleName == "Admin" {
		merchantID = cast.ToString(data["merchants_id"])

		if merchantID == "" {
			return nil, fmt.Errorf("merchants_id is required")
		}
	} else {
		merchantID = access.MerchantID

		if merchantID == "" {
			return nil, fmt.Errorf("merchant access is not configured")
		}
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	merchantID = strings.ReplaceAll(merchantID, "'", "''")
	name = strings.ReplaceAll(name, "'", "''")

	result, err := utils.SelectJoin(
		request,
		"merchants m",
		[]string{
			"m.guid",
			"w.guid AS warehouse_id",
		},
		[]map[string]string{
			{
				"type":  "LEFT",
				"table": "warehouse w",
				"condition": fmt.Sprintf(
					"w.merchants_id = m.guid AND w.name = '%s'",
					name,
				),
			},
		},
		fmt.Sprintf(
			"m.guid = '%s'",
			merchantID,
		),
		[]string{},
	)

	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("merchant not found")
	}

	if cast.ToString(result[0]["warehouse_id"]) != "" {
		return nil, fmt.Errorf("warehouse with this name already exists")
	}

	guid := uuid.New().String()

	createData := map[string]any{
		"guid":         guid,
		"name":         name,
		"merchants_id": merchantID,
	}

	if address != "" {
		createData["address"] = address
	}

	resp, raw, err := request.UcodeSdk.
		Items("warehouse").
		Create(createData).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to create warehouse")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateWarehousesCache(request, merchantID)

	return map[string]any{
		"message":  "warehouse created successfully",
		"response": resp.Data.Data.Data,
	}, nil
}

// Update warehouse
func UpdateWarehouse(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("UpdateWarehouse function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	warehouseID := cast.ToString(data["warehouse_id"])

	if warehouseID == "" {
		return nil, fmt.Errorf("warehouse_id is required")
	}

	warehouseID = strings.ReplaceAll(warehouseID, "'", "''")

	// Get warehouse merchant
	warehouse, err := utils.SelectOneItem(
		request,
		"warehouse",
		[]string{
			"guid",
			"merchants_id",
		},
		fmt.Sprintf("guid = '%s'", warehouseID),
		[]string{},
	)
	if err != nil {
		return nil, err
	}

	if len(warehouse) == 0 {
		return nil, fmt.Errorf("warehouse not found")
	}

	merchantID := cast.ToString(warehouse["merchants_id"])

	// Check access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	updateData := map[string]any{
		"guid": warehouseID,
	}

	name := cast.ToString(data["name"])
	if name != "" {
		name = strings.ReplaceAll(name, "'", "''")
		updateData["name"] = name
	}

	address := cast.ToString(data["address"])
	if address != "" {
		address = strings.ReplaceAll(address, "'", "''")
		updateData["address"] = address
	}

	resp, raw, err := request.UcodeSdk.
		Items("warehouse").
		Update(updateData).
		DisableFaas(true).
		ExecSingle()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", raw).
			Msg("failed to update warehouse")

		return nil, utils.ExtractUcodeError(raw, err)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateWarehousesCache(request, merchantID)

	return map[string]any{
		"message": "warehouse updated successfully",
		"data":    resp.Data.Data,
	}, nil
}

// Delete Warehouse
func DeleteWarehouse(request *models.FunctionRequest) (map[string]any, error) {
	request.Logger.Info().Msg("DeleteWarehouse function triggered")

	data := request.Data
	if data == nil {
		return nil, fmt.Errorf("data is required")
	}

	warehouseID := cast.ToString(data["warehouse_id"])

	if warehouseID == "" {
		return nil, fmt.Errorf("warehouse_id is required")
	}

	warehouseID = strings.ReplaceAll(warehouseID, "'", "''")

	warehouse, err := utils.SelectJoin(
		request,
		"warehouse w",
		[]string{
			"w.guid",
			"w.merchants_id",
			"COUNT(DISTINCT ws.guid) AS inventory_count",
			"COUNT(DISTINCT sm.guid) AS movement_count",
		},
		[]map[string]string{
			{
				"type":      "LEFT",
				"table":     "warehouse_stocks ws",
				"condition": "ws.warehouse_id = w.guid",
			},
			{
				"type":      "LEFT",
				"table":     "stock_movements sm",
				"condition": "(sm.warehouse_id = w.guid OR sm.warehouse_id_2 = w.guid)",
			},
		},
		fmt.Sprintf(
			"w.guid = '%s'",
			warehouseID,
		),
		[]string{
			"w.guid",
			"w.merchants_id",
		},
	)
	if err != nil {
		return nil, err
	}

	if len(warehouse) == 0 {
		return nil, fmt.Errorf("warehouse not found")
	}

	warehouseData := warehouse[0]
	merchantID := cast.ToString(warehouseData["merchants_id"])

	// Check access
	access, err := utils.GetUserAccess(request)
	if err != nil {
		return nil, err
	}

	if err := utils.CanManage(access, merchantID); err != nil {
		return nil, err
	}

	inventoryCount := cast.ToInt(warehouseData["inventory_count"])

	if inventoryCount > 0 {
		return nil, fmt.Errorf(
			"this warehouse cannot be deleted because it has inventory",
		)
	}

	movementCount := cast.ToInt(warehouseData["movement_count"])

	if movementCount > 0 {
		return nil, fmt.Errorf(
			"this warehouse cannot be deleted because it is linked to stock movements",
		)
	}

	resp, err := request.UcodeSdk.
		Items("warehouse").
		Delete().
		Single(warehouseID).
		Exec()

	if err != nil {
		request.Logger.
			Err(err).
			Interface("response", resp).
			Msg("failed to delete warehouse")

		return nil, utils.ExtractUcodeError(resp, err)
	}

	// ---------------------------  Cleare Cache -----------------------
	invalidateWarehousesCache(request, merchantID)

	return map[string]any{
		"message": "warehouse deleted successfully",
		"data":    resp.Data,
	}, nil
}

func invalidateWarehousesCache(request *models.FunctionRequest, merchantID string) {
	patterns := []string{
		fmt.Sprintf("warehouses:list:%s:*", merchantID), // shu merchant
		"warehouses:list::*",                            // Admin "hammasi" ro'yxati
	}

	for _, p := range patterns {
		if err := redis.DeleteWildCard(request, p); err != nil {
			request.Logger.Error().
				Err(err).
				Str("pattern", p).
				Msg("cache invalidation failed")
		}
	}
}
