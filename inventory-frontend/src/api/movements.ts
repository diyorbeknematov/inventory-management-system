import { invokeFunction } from "./client";
import type {
  GetMerchantSalesResponse,
  GetMerchantReceiptsResponse,
  GetMerchantReturnsResponse,
  GetMerchantWarehouseTransfersResponse,
  GetMerchantShopTransfersResponse,
  CreateStockMovementRequest,
  CreateStockMovementResponse,
  CreateStockMovementItemRequest,
  CreateStockMovementItemsResponse,
  UpdateStockMovementStatusRequest,
  UpdateStockMovementStatusResponse,
  UpdateStockMovementRequest,
  UpdateStockMovementResponse,
  DeleteStockMovementRequest,
  DeleteStockMovementResponse,
  DeleteStockMovementItemRequest,
  DeleteStockMovementItemResponse,
} from "../types/movement";

export async function getMerchantSales(
  data: Record<string, unknown>
): Promise<GetMerchantSalesResponse> {
  return invokeFunction<GetMerchantSalesResponse>(
    "get_merchant_sales",
    data
  );
}

export async function getMerchantReceipts(
  data: Record<string, unknown>
): Promise<GetMerchantReceiptsResponse> {
  return invokeFunction<GetMerchantReceiptsResponse>(
    "get_merchant_receipts",
    data
  );
}

export async function getMerchantWarehouseTransfers(
  data: Record<string, unknown>
): Promise<GetMerchantWarehouseTransfersResponse> {
  return invokeFunction<GetMerchantWarehouseTransfersResponse>(
    "get_merchant_warehouse_transfers",
    data
  );
}

export async function getMerchantShopTransfers(
  data: Record<string, unknown>
): Promise<GetMerchantShopTransfersResponse> {
  return invokeFunction<GetMerchantShopTransfersResponse>(
    "get_merchant_shop_transfers",
    data
  );
}

export async function getMerchantReturns(
  data: Record<string, unknown>
): Promise<GetMerchantReturnsResponse> {
  return invokeFunction<GetMerchantReturnsResponse>(
    "get_merchant_returns",
    data
  );
}

export async function createStockMovement(
  data: CreateStockMovementRequest
): Promise<CreateStockMovementResponse> {
  return invokeFunction<CreateStockMovementResponse>(
    "create_stock_movement",
    data
  );
}

export async function createStockMovementItem(
  data: CreateStockMovementItemRequest
): Promise<CreateStockMovementItemsResponse> {
  return invokeFunction<CreateStockMovementItemsResponse>(
    "create_stock_movement_item",
    data
  );
}

export async function updateStockMovementStatus(
  data: UpdateStockMovementStatusRequest
): Promise<UpdateStockMovementStatusResponse> {
  return invokeFunction<UpdateStockMovementStatusResponse>(
    "update_stock_movement_status",
    {
      ...data,
      status: [data.status],
      type: [data.type],
    }
  );
}

export async function updateStockMovement(
  data: UpdateStockMovementRequest
): Promise<UpdateStockMovementResponse> {
  return invokeFunction<UpdateStockMovementResponse>(
    "update_stock_movement",
    data
  );
}

export async function deleteStockMovement(
  data: DeleteStockMovementRequest
): Promise<DeleteStockMovementResponse> {
  return invokeFunction<DeleteStockMovementResponse>(
    "delete_stock_movement",
    data
  );
}

export async function deleteStockMovementItem(
  data: DeleteStockMovementItemRequest
): Promise<DeleteStockMovementItemResponse> {
  return invokeFunction<DeleteStockMovementItemResponse>(
    "delete_stock_movement_item",
    data
  );
}
