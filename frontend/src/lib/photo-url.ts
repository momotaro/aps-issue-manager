const MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://localhost:9000";
const MINIO_BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? "issues";

export function getPhotoUrl(storagePath: string): string {
  return `${MINIO_URL}/${MINIO_BUCKET}/${storagePath}`;
}
