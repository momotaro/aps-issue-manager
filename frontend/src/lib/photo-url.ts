const MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://localhost:9000";
const MINIO_BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? "issues";

function encodePathSegments(path: string): string {
  return path
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getPhotoUrl(storagePath: string): string {
  const url = new URL(MINIO_URL);
  const basePath = url.pathname.replace(/\/+$/g, "");
  const bucketPath = encodePathSegments(MINIO_BUCKET);
  const objectPath = encodePathSegments(storagePath);
  url.pathname = `${basePath}/${bucketPath}/${objectPath}`;
  return url.toString();
}
