import type * as Minio from "minio";
import { CopyDestinationOptions, CopySourceOptions } from "minio";
import type { BlobStorage } from "../../domain/services/blobStorage.js";
import type { Photo, PhotoPhase } from "../../domain/valueObjects/photo.js";
import {
  confirmedBlobPath,
  pendingBlobPath,
} from "../../domain/valueObjects/photo.js";

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
]);
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

const PRESIGNED_URL_EXPIRY = 600; // 10 minutes

const PENDING_PREFIX = "pending/";
const CONFIRMED_PREFIX = "confirmed/";

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

/** confirmPending 時に Photo のパスが `pending/{issueId}/{photoId}.{ext}` と完全一致するか厳密に検証する。 */
const validatePendingPath = (issueId: string, photo: Photo): void => {
  validateId(issueId, "issueId");
  validateId(photo.id, "photoId");

  const escaped = PENDING_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^${escaped}${issueId}/${photo.id}\\.([^.\\\\/]+)$`,
    "i",
  );
  const match = pattern.exec(photo.storagePath);

  if (!match) {
    throw new Error(
      `Invalid storage path: expected "${PENDING_PREFIX}${issueId}/${photo.id}.{ext}", got "${photo.storagePath}"`,
    );
  }

  const [, ext] = match;
  validateExt(ext);
};

/** deletePhoto 時にパスが `confirmed/` プレフィックスを持つことを検証する。 */
const validateConfirmedPath = (storagePath: string): void => {
  if (!storagePath.startsWith(CONFIRMED_PREFIX)) {
    throw new Error(
      `Invalid storage path: expected "${CONFIRMED_PREFIX}" prefix, got "${storagePath}"`,
    );
  }
};

const DELETE_BATCH_SIZE = 1000;

/** listObjects のストリームからチャンク単位で removeObjects を実行する。 */
const deleteObjectsByStream = (
  client: Minio.Client,
  bucket: string,
  stream: ReturnType<Minio.Client["listObjects"]>,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let batch: string[] = [];
    let pending: Promise<unknown> = Promise.resolve();

    const flush = (names: string[]) => {
      pending = pending
        .then(() => client.removeObjects(bucket, names))
        .catch(reject);
    };

    stream.on("data", (obj) => {
      if (obj.name) batch.push(obj.name);
      if (batch.length >= DELETE_BATCH_SIZE) {
        flush(batch);
        batch = [];
      }
    });
    stream.on("error", reject);
    stream.on("end", () => {
      if (batch.length > 0) flush(batch);
      pending.then(() => resolve()).catch(reject);
    });
  });

/** BlobStorage を生成する高階関数。 */
export const createBlobStorage = (
  client: Minio.Client,
  bucket: string,
): BlobStorage => ({
  generateUploadUrl: async (
    issueId: string,
    photoId: string,
    fileName: string,
    _phase: PhotoPhase,
  ): Promise<{ uploadUrl: string }> => {
    validateId(issueId, "issueId");
    validateId(photoId, "photoId");

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    validateExt(ext);

    const key = pendingBlobPath(issueId, photoId, ext);
    const uploadUrl = await client.presignedPutObject(
      bucket,
      key,
      PRESIGNED_URL_EXPIRY,
    );

    return { uploadUrl };
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

      const source = new CopySourceOptions({
        Bucket: bucket,
        Object: photo.storagePath,
      });
      const dest = new CopyDestinationOptions({
        Bucket: bucket,
        Object: newPath,
      });
      await client.copyObject(source, dest);
      await client.removeObject(bucket, photo.storagePath);

      confirmed.push({ ...photo, storagePath: newPath });
    }
    return confirmed;
  },

  deleteByIssue: async (issueId: string): Promise<void> => {
    validateId(issueId, "issueId");

    const prefix = `confirmed/${issueId}/`;
    const stream = client.listObjects(bucket, prefix, true);
    await deleteObjectsByStream(client, bucket, stream);
  },

  deletePhoto: async (storagePath: string): Promise<void> => {
    validateConfirmedPath(storagePath);
    await client.removeObject(bucket, storagePath);
  },
});
