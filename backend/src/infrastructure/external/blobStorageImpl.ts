import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import type { Photo } from "../../domain/valueObjects/photo.js";
import { confirmedBlobPath } from "../../domain/valueObjects/photo.js";

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
]);
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

const validateExt = (ext: string): void => {
  if (!ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
    throw new Error(`Invalid file extension: ${ext}`);
  }
};

const validateId = (id: string, label: string): void => {
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`Invalid ${label}: ${id}`);
  }
};

const PENDING_PREFIX = "pending/";

/** confirmPending 時に Photo のパスが正しい pending プレフィックスか検証する。 */
const validatePendingPath = (issueId: string, photo: Photo): void => {
  const expectedPrefix = `${PENDING_PREFIX}${issueId}/`;
  if (!photo.storagePath.startsWith(expectedPrefix)) {
    throw new Error(
      `Invalid storage path: expected prefix "${expectedPrefix}", got "${photo.storagePath}"`,
    );
  }
  const ext = photo.storagePath.split(".").pop() ?? "";
  validateExt(ext);
  validateId(photo.id, "photoId");
};

export type BlobStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

/** BlobStorage を生成する高階関数。 */
export const createBlobStorage = (config: BlobStorageConfig): BlobStorage => {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? true,
  });
  const bucket = config.bucket;

  return {
    uploadPending: async (
      issueId: string,
      photoId: string,
      data: Buffer,
      ext: string,
    ): Promise<string> => {
      validateId(issueId, "issueId");
      validateId(photoId, "photoId");
      validateExt(ext);

      const key = `pending/${issueId}/${photoId}.${ext}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
        }),
      );
      return key;
    },

    confirmPending: async (
      issueId: string,
      photos: readonly Photo[],
    ): Promise<readonly Photo[]> => {
      validateId(issueId, "issueId");

      const confirmed: Photo[] = [];
      for (const photo of photos) {
        validatePendingPath(issueId, photo);

        const ext = photo.storagePath.split(".").pop() ?? "";
        const newPath = confirmedBlobPath(issueId, photo.phase, photo.id, ext);

        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${photo.storagePath}`,
            Key: newPath,
          }),
        );

        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: photo.storagePath,
          }),
        );

        confirmed.push({ ...photo, storagePath: newPath });
      }
      return confirmed;
    },

    deleteByIssue: async (issueId: string): Promise<void> => {
      validateId(issueId, "issueId");

      const prefix = `confirmed/${issueId}/`;
      let continuationToken: string | undefined;

      do {
        const listed = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );

        if (listed.Contents && listed.Contents.length > 0) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects: listed.Contents.filter((obj) => obj.Key).map(
                  (obj) => ({ Key: obj.Key }),
                ),
              },
            }),
          );
        }

        continuationToken = listed.NextContinuationToken;
      } while (continuationToken);
    },
  };
};
