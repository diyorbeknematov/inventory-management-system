import { invokeFunction } from "./client";

import type { 
  GetUsersResponse,
  CreateUserRequest,
  CreateUserResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  DeleteUserRequest,
  DeleteUserResponse,
} from "../types/users";


export async function getUsers(
  search?: string
): Promise<GetUsersResponse> {
  return invokeFunction<GetUsersResponse>(
    "get_users", 
    {
    ...(search ? { search } : {}),
    }
  );
}

export async function createUser(
  data: CreateUserRequest
): Promise<CreateUserResponse> {
  return invokeFunction<CreateUserResponse>(
    "create_user",
    data
  );
}

export async function updateProfile(
  data: UpdateProfileRequest
): Promise<UpdateProfileResponse> {
  return invokeFunction<UpdateProfileResponse>(
    "update_user_profile",
    data
  );
}

export async function deleteUser(
  data: DeleteUserRequest
): Promise<DeleteUserResponse> {
  return invokeFunction<DeleteUserResponse>(
    "delete_user",
    data
  );
}

