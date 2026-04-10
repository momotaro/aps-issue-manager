import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  generateId,
  type PhotoId,
} from "../../domain/valueObjects/brandedId.js";
import { createPhoto } from "../../domain/valueObjects/photo.js";
import { createBlobStorage } from "./blobStorageImpl.js";
import { createMinioClient } from "./minioClient.js";

const minioClient = createMinioClient({
  endPoint: "localhost",
  port: 9000,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

const bucket = "issues";
const storage = createBlobStorage(minioClient, bucket);

const issueId = "019577a0-0000-7000-8000-000000000099";
const commentId = "019577a0-0000-7000-8000-000000000088";

/** テスト前後にバケット内のオブジェクトをクリーンアップする。 */
const cleanBucket = async () => {
  for (const prefix of [`pending/${issueId}/`, `confirmed/${issueId}/`]) {
    const names: string[] = [];
    const stream = minioClient.listObjects(bucket, prefix, true);
    for await (const obj of stream) {
      if (obj.name) names.push(obj.name);
    }
    if (names.length > 0) {
      await minioClient.removeObjects(bucket, names);
    }
  }
};

/** pending にテスト用ファイルを直接アップロードする（テスト準備用）。 */
const uploadToPending = async (
  photoId: string,
  ext: string,
): Promise<string> => {
  const key = `pending/${issueId}/${commentId}/${photoId}.${ext}`;
  const data = Buffer.from("test image data");
  await minioClient.putObject(bucket, key, data);
  return key;
};

describe("blobStorageImpl（結合テスト）", () => {
  beforeEach(async () => {
    await cleanBucket();
  });

  afterAll(async () => {
    await cleanBucket();
  });

  // -------------------------------------------------------------------------
  // generateUploadUrl
  // -------------------------------------------------------------------------

  it("generateUploadUrl で presigned PUT URL が返却される", async () => {
    const photoId = generateId<PhotoId>();
    const result = await storage.generateUploadUrl(
      issueId,
      commentId,
      photoId,
      "photo.jpg",
    );

    expect(result.uploadUrl).toBeDefined();
    expect(typeof result.uploadUrl).toBe("string");
    expect(result.uploadUrl).toContain(
      `pending/${issueId}/${commentId}/${photoId}.jpg`,
    );
  });

  it("generateUploadUrl で不正な拡張子はエラーになる", async () => {
    const photoId = generateId<PhotoId>();

    await expect(
      storage.generateUploadUrl(issueId, commentId, photoId, "malware.exe"),
    ).rejects.toThrow("Invalid file extension");
  });

  it("generateUploadUrl で不正な issueId はエラーになる", async () => {
    const photoId = generateId<PhotoId>();

    await expect(
      storage.generateUploadUrl("invalid-id", commentId, photoId, "photo.jpg"),
    ).rejects.toThrow("Invalid issueId");
  });

  // -------------------------------------------------------------------------
  // confirmPending
  // -------------------------------------------------------------------------

  it("confirmPending で pending → confirmed に移動する", async () => {
    const photoId = generateId<PhotoId>();
    const pendingPath = await uploadToPending(photoId, "jpg");

    const photo = createPhoto({
      id: photoId,
      fileName: "test.jpg",
      storagePath: pendingPath,
      uploadedAt: new Date(),
    });

    const confirmed = await storage.confirmPending(issueId, [photo]);

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].storagePath).toBe(
      `confirmed/${issueId}/${commentId}/${photoId}.jpg`,
    );

    // confirmed 側にオブジェクトが存在する
    const stat = await minioClient.statObject(bucket, confirmed[0].storagePath);
    expect(stat).toBeDefined();

    // pending 側は削除されている
    await expect(minioClient.statObject(bucket, pendingPath)).rejects.toThrow();
  });

  it("confirmPending で不正な storagePath はエラーになる", async () => {
    const photoId = generateId<PhotoId>();

    const photo = createPhoto({
      id: photoId,
      fileName: "test.jpg",
      storagePath: `wrong/${issueId}/${photoId}.jpg`,
      uploadedAt: new Date(),
    });

    await expect(storage.confirmPending(issueId, [photo])).rejects.toThrow(
      "Invalid storage path",
    );
  });

  // -------------------------------------------------------------------------
  // deleteByIssue
  // -------------------------------------------------------------------------

  it("deleteByIssue で confirmed 配下を一括削除する", async () => {
    const photoId = generateId<PhotoId>();
    const pendingPath = await uploadToPending(photoId, "png");

    const photo = createPhoto({
      id: photoId,
      fileName: "test.png",
      storagePath: pendingPath,
      uploadedAt: new Date(),
    });
    await storage.confirmPending(issueId, [photo]);

    await storage.deleteByIssue(issueId);

    const names: string[] = [];
    const stream = minioClient.listObjects(
      bucket,
      `confirmed/${issueId}/`,
      true,
    );
    for await (const obj of stream) {
      if (obj.name) names.push(obj.name);
    }
    expect(names).toHaveLength(0);
  });

  it("存在しないオブジェクトの deleteByIssue はエラーにならない", async () => {
    await expect(
      storage.deleteByIssue("019577a0-0000-7000-8000-000000000000"),
    ).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // deletePhoto
  // -------------------------------------------------------------------------

  it("deletePhoto で個別の写真を削除する", async () => {
    const photoId = generateId<PhotoId>();
    const pendingPath = await uploadToPending(photoId, "jpg");

    const photo = createPhoto({
      id: photoId,
      fileName: "test.jpg",
      storagePath: pendingPath,
      uploadedAt: new Date(),
    });
    const confirmed = await storage.confirmPending(issueId, [photo]);

    await storage.deletePhoto(confirmed[0].storagePath);

    await expect(
      minioClient.statObject(bucket, confirmed[0].storagePath),
    ).rejects.toThrow();
  });

  it("deletePhoto で confirmed/ 以外のパスはエラーになる", async () => {
    await expect(storage.deletePhoto("pending/some-file.jpg")).rejects.toThrow(
      'expected "confirmed/" prefix',
    );
  });
});
