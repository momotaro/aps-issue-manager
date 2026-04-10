/**
 * コメントの値オブジェクト。Issue 集約に従属する。
 *
 * @remarks
 * コメントは immutable（追加のみ）。施工現場の指摘管理では
 * 「誰がいつ何を言ったか」が変更されないことに価値がある。
 * 将来的に編集が必要な場合は `CommentEdited` イベントで拡張する。
 */

import type { CommentId, UserId } from "./brandedId.js";
import type { Photo } from "./photo.js";

/** コメント本文の最大文字数。 */
export const COMMENT_MAX_LENGTH = 2000;

/** コメント添付写真の最大件数。 */
export const COMMENT_MAX_ATTACHMENTS = 10;

/**
 * コメントの値オブジェクト。
 *
 * @remarks
 * Issue 集約の一部として管理される。独立したエンティティではない。
 */
export type Comment = {
  /** コメントの一意識別子。 */
  readonly commentId: CommentId;
  /** コメント本文。 */
  readonly body: string;
  /** 投稿者の User ID。 */
  readonly actorId: UserId;
  /** 添付写真の一覧。 */
  readonly attachments: readonly Photo[];
  /**
   * 投稿日時。
   * JSONB に保存する際は ISO 8601 文字列に変換される。復元時は `new Date()` でパースすること。
   */
  readonly createdAt: Date;
};

/**
 * Comment 値オブジェクトを生成する。
 *
 * @param params - コメントのプロパティ
 * @returns 凍結された Comment オブジェクト
 */
export const createComment = (params: {
  commentId: CommentId;
  body: string;
  actorId: UserId;
  attachments?: readonly Photo[];
  createdAt: Date;
}): Comment =>
  Object.freeze({
    commentId: params.commentId,
    body: params.body,
    actorId: params.actorId,
    attachments: Object.freeze([...(params.attachments ?? [])]),
    createdAt: params.createdAt,
  });
