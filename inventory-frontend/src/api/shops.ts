import { invokeFunction } from "./client";

import type {
  GetMerchantShopsResponse,
  CreateShopRequest,
  CreateShopResponse,
  CreateShopInventoryRequest,
  CreateShopInventoryResponse,
  UpdateShopRequest,
  UpdateShopResponse,
  DeleteShopResponse,
} from "../types/shop";

export async function getMerchantShops(
  merchantId: string,
  shopId?: string,
  search?: string
): Promise<GetMerchantShopsResponse> {
  return invokeFunction<GetMerchantShopsResponse>(
    "get_merchant_shops",
    {
      merchants_id: merchantId,
      ...(shopId ? { shop_id: shopId } : {}),
      ...(search ? { search } : {}),
    }
  );
}

export async function createShop(
  data: CreateShopRequest
): Promise<CreateShopResponse> {
  return invokeFunction<CreateShopResponse>(
    "create_shop",
    data
  );
}

export async function createShopInventory(
  data: CreateShopInventoryRequest
): Promise<CreateShopInventoryResponse> {
  return invokeFunction<CreateShopInventoryResponse>(
    "create_shop_stock",
    data
  );
}

export async function updateShop(
  data: UpdateShopRequest
): Promise<UpdateShopResponse> {
  return invokeFunction<UpdateShopResponse>(
    "update_shop",
    data
  );
}

export async function deleteShop(
  shop_id: string
): Promise<DeleteShopResponse> {
  return invokeFunction<DeleteShopResponse>(
    "delete_shop",
    {
      shop_id,
    }
  );
}

