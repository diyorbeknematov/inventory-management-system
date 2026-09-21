import { getAccessToken } from "./client";

export async function uploadImage(
  file: File
): Promise<string> {
  const token = getAccessToken();

  if (!token) {
    throw new Error(
      "User is not authenticated"
    );
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("title", file.name);

  const response = await fetch(
    "https://api.admin.u-code.io/v1/files/folder_upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": token,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Image upload failed: ${errorText}`
    );
  }

  const result =
    await response.json();

  return "https://cdn.u-code.io/" + result.data.link;
}

export async function uploadImages(
  files: File[]
): Promise<string[]> {
  return Promise.all(
    files.map(uploadImage)
  );
}
