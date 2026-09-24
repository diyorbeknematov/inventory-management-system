import { invokeFunction } from "./client";

import type {
  GetStockMovementsResponse,
  GetStockMovementItemsRequest,
  GetStockMovementItemsResponse,
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

export async function getStockMovements(
  data: Record<string, unknown>
): Promise<GetStockMovementsResponse> {
  return invokeFunction<GetStockMovementsResponse>(
    "get_stock_movements",
    data
  );
}

export async function getStockMovementItems(
  data: GetStockMovementItemsRequest
): Promise<GetStockMovementItemsResponse> {
  return invokeFunction<GetStockMovementItemsResponse>(
    "get_stock_movement_items",
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
