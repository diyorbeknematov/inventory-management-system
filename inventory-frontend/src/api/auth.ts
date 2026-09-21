import { apiFetch } from "./client";

import type { LoginResponse } from "../types/auth";

const API_KEY = "P-n5hHJwLiO7rfVyrFyfj5JFnMDY5BduOc"
const PROJECT_NAME = "diyorbek-nematov-diyorbek-inventory";
const PROJECT_ID = "fe8c7b71-e71e-4fd0-a41a-c5282ab75a25";

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(
    `/v2/invoke_function/${PROJECT_NAME}?project-id=${PROJECT_ID}`,
    {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        Authorization: "API-KEY"
      },
      body: JSON.stringify({
        data: {
          method: "login",
          object_data: {
            username,
            password,
          },
        },
      }),
    }
  );
}
