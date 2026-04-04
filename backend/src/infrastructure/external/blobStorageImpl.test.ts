import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  generateId,
  type PhotoId,
} from "../../domain/valueObjects/brandedId.js";
import { createPhoto } from "../../domain/valueObjects/photo.js";
import {
  type BlobStorageConfig,
  createBlobStorage,
} from "./blobStorageImpl.js";

const config: BlobStorageConfig = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  bucket: "issues",
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
  forcePathStyle: true,
};

const s3 = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
  forcePathStyle: true,
});

const issueId = "019577a0-0000-7000-8000-000000000099";

const cleanBucket = async () => {
  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  for (const prefix of [`pending/${issueId}/`, `confirmed/${issueId}/`]) {
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix }),
    );
    if (listed.Contents && listed.Contents.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) },
        }),
      );
    }
  }
};

describe("blobStorageImpl（結合テスト）", () => {
  const storage = createBlobStorage(config);

  beforeEach(async () => {
    await cleanBucket();
  });

  afterAll(async () => {
    await cleanBucket();
  });

  it("uploadPending でオブジェクトが作成される", async () => {
    const photoId = generateId<PhotoId>();
    const data = Buffer.from("test image data");

    const path = await storage.uploadPending(issueId, photoId, data, "jpg");

    expect(path).toBe(`pending/${issueId}/${photoId}.jpg`);

    const obj = await s3.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: path }),
    );
    expect(obj.Body).toBeDefined();
  });

  it("confirmPending で pending → confirmed に移動する", async () => {
    const photoId = generateId<PhotoId>();
    const data = Buffer.from("test image data");
    const pendingPath = await storage.uploadPending(
      issueId,
      photoId,
      data,
      "jpg",
    );

    const photo = createPhoto({
      id: photoId,
      fileName: "test.jpg",
      storagePath: pendingPath,
      phase: "before",
      uploadedAt: new Date(),
    });

    const confirmed = await storage.confirmPending(issueId, [photo]);

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].storagePath).toBe(
      `confirmed/${issueId}/before/${photoId}.jpg`,
    );

    // confirmed 側にオブジェクトが存在する
    const obj = await s3.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: confirmed[0].storagePath,
      }),
    );
    expect(obj.Body).toBeDefined();

    // pending 側は削除されている
    await expect(
      s3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: pendingPath }),
      ),
    ).rejects.toThrow();
  });

  it("deleteByIssue で confirmed 配下を一括削除する", async () => {
    const photoId = generateId<PhotoId>();
    const data = Buffer.from("test image data");
    const pendingPath = await storage.uploadPending(
      issueId,
      photoId,
      data,
      "png",
    );

    const photo = createPhoto({
      id: photoId,
      fileName: "test.png",
      storagePath: pendingPath,
      phase: "after",
      uploadedAt: new Date(),
    });
    await storage.confirmPending(issueId, [photo]);

    await storage.deleteByIssue(issueId);

    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: `confirmed/${issueId}/`,
      }),
    );
    expect(listed.Contents ?? []).toHaveLength(0);
  });

  it("存在しないオブジェクトの deleteByIssue はエラーにならない", async () => {
    await expect(
      storage.deleteByIssue("019577a0-0000-7000-8000-000000000000"),
    ).resolves.not.toThrow();
  });
});
