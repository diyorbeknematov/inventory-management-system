
const BASE_URL = "https://api.admin.u-code.io";

const PROJECT_NAME = "diyorbek-nematov-diyorbek-inventory";
const PROJECT_ID = "fe8c7b71-e71e-4fd0-a41a-c5282ab75a25";


export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(
    `${BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    }
  );

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    window.location.href = "/login";

    throw new Error("Session expired");
  }

  if (!response.ok) {
    const errorText =
      await response.text();

    try {
      const errorData =
        JSON.parse(errorText);

      throw new Error(
        errorData.data ||
          errorData.custom_message ||
          errorData.description ||
          "Something went wrong"
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Something went wrong"
      );
    }
  }

  return response.json();
}


export async function invokeFunction<T>(
  method: string,
  objectData: object
): Promise<T> {
  return apiFetch<T>(
    `/v2/invoke_function/${PROJECT_NAME}?project-id=${PROJECT_ID}`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          method,
          object_data: objectData,
        },
      }),
    }
  );
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}
