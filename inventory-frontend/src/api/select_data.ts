import { invokeFunction } from "./client";

import type { 
  GetMerchantsForSelectResponse,
  GetRolesForSelectResponse,
  GetShopsForSelectResponse,
  GetWarehousesForSelectResponse,
  GetProductsForSelectResponse,
} from "../types/select_data";


export async function getMerchantsForSelect(
  data: Record<string, unknown> = {}
): Promise<GetMerchantsForSelectResponse> {
  return invokeFunction<GetMerchantsForSelectResponse>(
    "get_merchants_for_select",
    data
  );
}

export async function getRolesForSelect(
  data: Record<string, unknown> = {}
): Promise<GetRolesForSelectResponse> {
  return invokeFunction<GetRolesForSelectResponse>(
    "get_roles_for_select",
    data
  );
}

export async function getShopsForSelect(
  merchantId: string,
  shopId?: string
): Promise<GetShopsForSelectResponse> {
  return invokeFunction<GetShopsForSelectResponse>(
    "get_shops_for_select",
    {
      merchants_id: merchantId,
      ...(shopId ? { shop_id: shopId } : {}),
    }
  );
}


export async function getWarehousesForSelect(
  merchantId: string
): Promise<GetWarehousesForSelectResponse> {
  return invokeFunction<GetWarehousesForSelectResponse>(
    "get_warehouses_for_select",
    {
      merchants_id: merchantId,
    }
  );
}

export async function getProductsForSelect(
  merchantId: string
): Promise<GetProductsForSelectResponse> {
  return invokeFunction<GetProductsForSelectResponse>(
    "get_products_for_select",
    {
      merchants_id: merchantId,
    }
  );
}