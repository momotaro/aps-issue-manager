import * as Minio from "minio";

export type MinioClientConfig = {
  endPoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL?: boolean;
  region?: string;
};

/** MinIO クライアントを生成するファクトリ関数。 */
export const createMinioClient = (config: MinioClientConfig): Minio.Client =>
  new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL ?? false,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
  });
