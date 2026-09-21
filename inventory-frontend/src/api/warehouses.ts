import { invokeFunction } from "./client";

import type {
  GetMerchantWarehousesResponse,
  CreateWarehouseRequest,
  CreateWarehouseResponse,
  CreateWarehouseStockRequest,
  CreateWarehouseStockResponse,
  UpdateWarehouseRequest,
  UpdateWarehouseResponse,
  DeleteWarehouseResponse,
} from "../types/warehouse";

export async function getMerchantWarehouses(
  merchantId: string,
  search?: string,
): Promise<GetMerchantWarehousesResponse> {
  return invokeFunction<GetMerchantWarehousesResponse>(
    "get_merchant_warehouses",
    {
      merchants_id: merchantId,
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
