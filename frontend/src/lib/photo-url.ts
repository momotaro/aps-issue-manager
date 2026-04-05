const MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://localhost:9000";
const MINIO_BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? "issues";

export function getPhotoUrl(storagePath: string): string {
  const base = MINIO_URL.replace(/\/+$/, "");
  const bucket = MINIO_BUCKET.replace(/^\/+|\/+$/g, "");
  const path = storagePath.replace(/^\/+/, "");
  return `${base}/${bucket}/${path}`;
}
