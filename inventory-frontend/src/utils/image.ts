export default function getImageUrls(
  value: unknown
): string[] {
  const result: string[] = [];

  const collect = (
    item: unknown
  ) => {
    if (typeof item === "string") {
      result.push(item);
      return;
    }

    if (Array.isArray(item)) {
      for (const child of item) {
        collect(child);
      }
    }
  };

  collect(value);

  return result.filter(Boolean);
}