import { invokeFunction } from "./client";

import type {
  GetProductsResponse,
  GetProductVariationsResponse,
  CreateProductRequest,
  CreateProductResponse,
  CreateVariationRequest,
  CreateVariationResponse,
  UpdateProductRequest,
  UpdateProductResponse,
  DeleteProductResponse,
  UpdateVariationRequest,
  UpdateVariationResponse,
  DeleteVariationRequest,
  DeleteVariationResponse,
} from "../types/products";

export async function getProducts(
  merchantId?: string,
  search?: string,
): Promise<GetProductsResponse> {
  return invokeFunction<GetProductsResponse>(
    "get_products",
    {
      ...(merchantId ? { merchants_id: merchantId } : {}),
      ...(search ? { search } : {}),
    }
  );
}

export async function getProductVariations(
  productId: string,
  search?: string,
): Promise<GetProductVariationsResponse> {
  return invokeFunction<GetProductVariationsResponse>(
    "get_product_variations",
    {
      product_id: productId,
      ...(search ? { search } : {}),
    }
  );
}

export async function createProduct(
  data: CreateProductRequest
): Promise<CreateProductResponse> {
  return invokeFunction<CreateProductResponse>(
    "create_product",
    data
  );
}

export async function updateProduct(
  data: UpdateProductRequest
): Promise<UpdateProductResponse> {
  return invokeFunction<UpdateProductResponse>(
    "update_product",
    data
  );
}

export async function deleteProduct(
  guid: string
): Promise<DeleteProductResponse> {
  return invokeFunction<DeleteProductResponse>(
    "delete_product",
    {
      product_id: guid,
    }
  );
}

export async function createProductVariation(
  data: CreateVariationRequest
): Promise<CreateVariationResponse> {
  return invokeFunction<CreateVariationResponse>(
    "create_product_variation",
    data
  );
}

export async function updateProductVariation(
  data: UpdateVariationRequest
): Promise<UpdateVariationResponse> {
  return invokeFunction<UpdateVariationResponse>(
    "update_product_variation",
    data
  );
}

export async function deleteProductVariation(
  data: DeleteVariationRequest
): Promise<DeleteVariationResponse> {
  return invokeFunction<DeleteVariationResponse>(
    "delete_product_variation",
    data
  );
}
