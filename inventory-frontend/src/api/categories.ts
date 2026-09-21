import { invokeFunction } from "./client";
import type {
  GetCategoriesResponse,
  CreateCategoryResponse,
  UpdateCategoryResponse,
  DeleteCategoryResponse,
} from "../types/category";

export async function getCategories(
  merchantId: string,
  search?: string
): Promise<GetCategoriesResponse> {
  return invokeFunction<GetCategoriesResponse>(
    "get_merchant_categories",
    {
      merchants_id: merchantId,
      ...(search ? { search } : {}),
    }
  );
}

export async function createCategory(data: {
  name: string;
  description: string;
  category_id: string | null;
  merchants_id: string;
}): Promise<CreateCategoryResponse> {
  return invokeFunction<CreateCategoryResponse>(
    "create_category",
    data
  );
}

export async function updateCategory(data: {
  guid: string;
  name: string;
  description: string;
  category_id: string | null;
}): Promise<UpdateCategoryResponse> {
  return invokeFunction<UpdateCategoryResponse>(
    "update_category",
    data
  );
}

export async function deleteCategory(
  guid: string
): Promise<DeleteCategoryResponse> {
  return invokeFunction<DeleteCategoryResponse>(
    "delete_category",
    {
      category_id: guid,
    }
  );
}