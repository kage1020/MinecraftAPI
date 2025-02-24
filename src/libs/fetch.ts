export async function get(r2: R2Bucket, key: string) {
  return await r2.get(key);
}

export async function list(r2: R2Bucket, options: R2ListOptions) {
  const data = await r2.list(options);
  let truncated = data.truncated;
  let cursor = data.truncated ? data.cursor : undefined;

  while (truncated) {
    const next = await r2.list({ ...options, cursor });
    data.objects.push(...next.objects);
    truncated = next.truncated;
    cursor = next.truncated ? next.cursor : undefined;
  }

  return data.objects;
}
