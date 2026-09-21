import { invokeFunction } from "./client";

import type {
  GetMerchantsResponse
} from "../types/merchant"

export async function getMerchants(): Promise<GetMerchantsResponse> {
  return invokeFunction<GetMerchantsResponse>(
    "get_merchants", 
    {

    }
  );
}
