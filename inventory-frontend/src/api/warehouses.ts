import { invokeFunction } from "./client";

import type {
  GetWarehousesResponse,
  GetWarehouseStocksResponse,
  CreateWarehouseRequest,
  CreateWarehouseResponse,
  CreateWarehouseStockRequest,
  CreateWarehouseStockResponse,
  UpdateWarehouseRequest,
  UpdateWarehouseResponse,
  DeleteWarehouseResponse,
} from "../types/warehouse";

export async function getWarehouses(
  merchantId?: string,
  search?: string,
): Promise<GetWarehousesResponse> {
  return invokeFunction<GetWarehousesResponse>(
    "get_warehouses",
    {
      ...(merchantId ? { merchants_id: merchantId } : {}),
      ...(search ? { search } : {}),
    }
  );
}

export async function getWarehouseStocks(
  warehouseId: string,
  search?: string,
): Promise<GetWarehouseStocksResponse> {
  return invokeFunction<GetWarehouseStocksResponse>(
    "get_warehouse_stocks",
    {
      warehouse_id: warehouseId,
      ...(search ? { search } : {}),
    }
  );
}

export async function createWarehouse(
  data: CreateWarehouseRequest
): Promise<CreateWarehouseResponse> {
  return invokeFunction<CreateWarehouseResponse>(
    "create_warehouse",
    data
  );
}

export async function createWarehouseStock(
  data: CreateWarehouseStockRequest
): Promise<CreateWarehouseStockResponse> {
  return invokeFunction<CreateWarehouseStockResponse>(
    "create_warehouse_stocks",
    data
  );
}

export async function updateWarehouse(
  data: UpdateWarehouseRequest
): Promise<UpdateWarehouseResponse> {
  return invokeFunction<UpdateWarehouseResponse>(
    "update_warehouse",
    data
  );
}

export async function deleteWarehouse(
  warehouse_id: string
): Promise<DeleteWarehouseResponse> {
  return invokeFunction<DeleteWarehouseResponse>(
    "delete_warehouse",
    {
      warehouse_id,
    }
  );
}
