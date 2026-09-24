import { invokeFunction } from "./client";

import type {
  GetMerchantsResponse,
  CreateMerchantRequest,
  CreateMerchantResponse,
  UpdateMerchantRequest,
  UpdateMerchantResponse,
  DeleteMerchantRequest,
  DeleteMerchantResponse,
} from "../types/merchant";

export async function getMerchants(): Promise<GetMerchantsResponse> {
  return invokeFunction<GetMerchantsResponse>(
    "get_merchants",
    {}
  );
}

export async function createMerchant(
  data: CreateMerchantRequest
): Promise<CreateMerchantResponse> {
  return invokeFunction<CreateMerchantResponse>(
    "create_merchant",
    data
  );
}

export async function updateMerchant(
  data: UpdateMerchantRequest
): Promise<UpdateMerchantResponse> {
  return invokeFunction<UpdateMerchantResponse>(
    "update_merchant",
    data
  );
}

export async function deleteMerchant(
  data: DeleteMerchantRequest
): Promise<DeleteMerchantResponse> {
  return invokeFunction<DeleteMerchantResponse>(
    "delete_merchant",
    data
  );
}