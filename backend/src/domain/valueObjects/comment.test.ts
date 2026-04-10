import { describe, expect, it } from "vitest";
import { type CommentId, generateId, type UserId } from "./brandedId.js";
import { COMMENT_MAX_LENGTH, createComment } from "./comment.js";

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
});
