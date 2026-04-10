import { describe, expect, it } from "vitest";
import {
  type CommentId,
  generateId,
  type PhotoId,
  type UserId,
} from "./brandedId.js";
import {
  COMMENT_MAX_ATTACHMENTS,
  COMMENT_MAX_LENGTH,
  createComment,
} from "./comment.js";
import { createPhoto } from "./photo.js";

const actorId = generateId<UserId>();

describe("createComment（値オブジェクト）", () => {
  it("正常なパラメータでコメントを生成できる", () => {
    const commentId = generateId<CommentId>();
    const createdAt = new Date();
    const comment = createComment({
      commentId,
      body: "コメント本文",
      actorId,
      createdAt,
    });
    expect(comment.commentId).toBe(commentId);
    expect(comment.body).toBe("コメント本文");
    expect(comment.actorId).toBe(actorId);
    expect(comment.createdAt).toBe(createdAt);
  });

  it("生成されたオブジェクトは凍結されている", () => {
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body: "本文",
      actorId,
      createdAt: new Date(),
    });
    expect(Object.isFrozen(comment)).toBe(true);
  });

  it("ちょうど最大文字数（COMMENT_MAX_LENGTH）の body は問題なく生成できる", () => {
    const body = "a".repeat(COMMENT_MAX_LENGTH);
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body,
      actorId,
      createdAt: new Date(),
    });
    expect(comment.body).toBe(body);
  });

  it("attachments 省略時は空配列になる", () => {
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body: "本文",
      actorId,
      createdAt: new Date(),
    });
    expect(comment.attachments).toEqual([]);
    expect(comment.attachments).toHaveLength(0);
  });

  it("attachments に写真を渡すと保持される", () => {
    const photo = createPhoto({
      id: generateId<PhotoId>(),
      fileName: "crack.jpg",
      storagePath: "confirmed/xxx/cmt/yyy.jpg",
      uploadedAt: new Date(),
    });
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body: "写真付き",
      actorId,
      attachments: [photo],
      createdAt: new Date(),
    });
    expect(comment.attachments).toHaveLength(1);
    expect(comment.attachments[0].fileName).toBe("crack.jpg");
  });

  it("attachments 配列は凍結されている", () => {
    const photo = createPhoto({
      id: generateId<PhotoId>(),
      fileName: "crack.jpg",
      storagePath: "confirmed/xxx/cmt/yyy.jpg",
      uploadedAt: new Date(),
    });
    const comment = createComment({
      commentId: generateId<CommentId>(),
      body: "写真付き",
      actorId,
      attachments: [photo],
      createdAt: new Date(),
    });
    expect(Object.isFrozen(comment.attachments)).toBe(true);
  });

  it("COMMENT_MAX_ATTACHMENTS が 10 である", () => {
    expect(COMMENT_MAX_ATTACHMENTS).toBe(10);
  });
});
