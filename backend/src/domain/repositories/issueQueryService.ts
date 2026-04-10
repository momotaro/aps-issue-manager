/**
 * IssueQueryService インターフェース（CQRS 読み取り側）。
 *
 * @remarks
 * イベントソーシングの読み取り側を担当する。
 * 集約やイベント列を経由せず、非正規化された読み取りモデル（投影テーブル）から
 * 直接データを取得する。
 *
 * 読み取りモデルは {@link EventProjector} によってイベント発生時に同期更新される。
 */

import type { IssueDomainEvent } from "../events/issueEvents.js";
import type { IssueId, ProjectId, UserId } from "../valueObjects/brandedId.js";
import type { Comment } from "../valueObjects/comment.js";
import type { IssueCategory } from "../valueObjects/issueCategory.js";
import type { IssueStatus } from "../valueObjects/issueStatus.js";
import type { Photo } from "../valueObjects/photo.js";
import type { Position } from "../valueObjects/position.js";

// ---------------------------------------------------------------------------
// 読み取りモデルの型
// ---------------------------------------------------------------------------

/**
 * 指摘一覧の表示用 DTO。
 *
 * @remarks
 * 一覧画面で必要な最小限のフィールドのみ含む。
 * 写真は件数のみ保持し、詳細は {@link IssueDetail} で取得する。
 */
export type IssueListItem = {
  readonly id: IssueId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly status: IssueStatus;
  readonly category: IssueCategory;
  readonly reporterName: string | null;
  readonly assigneeName: string | null;
  readonly position: Position;
  readonly photoCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * 指摘の詳細 DTO。
 *
 * @remarks
 * 一覧項目に加えて、説明文と写真の完全な一覧を含む。
 */
export type IssueDetail = IssueListItem & {
  readonly description: string;
  readonly photos: readonly Photo[];
  /**
   * 最新5件のコメントキャッシュ。
   * 全コメントを取得する場合はイベント履歴（`getEventHistory`）を参照すること。
   */
  readonly recentComments: readonly Comment[];
};

// ---------------------------------------------------------------------------
// フィルター条件
// ---------------------------------------------------------------------------

/**
 * 指摘一覧のフィルター条件。
 *
 * @remarks
 * すべてのフィールドはオプション。指定されたフィールドのみ AND 条件で絞り込む。
 */
export type IssueFilters = {
  /** プロジェクト ID で絞り込む。 */
  readonly projectId?: ProjectId;
  /** ステータスで絞り込む。 */
  readonly status?: IssueStatus;
  /** 種別で絞り込む。 */
  readonly category?: IssueCategory;
  /** 担当者で絞り込む。 */
  readonly assigneeId?: UserId;
  /** タイトル・説明の部分一致検索（ILIKE）。 */
  readonly keyword?: string;
};

/**
 * クエリのソート・ページング等の制御オプション。
 *
 * @remarks
 * ビジネスフィルタ（IssueFilters）とクエリ制御を分離するための型。
 */
export type QueryOptions = {
  /** ソートカラム。デフォルトは updatedAt。 */
  readonly sortBy?: "createdAt" | "updatedAt";
  /** ソート方向。デフォルトは desc。 */
  readonly sortOrder?: "asc" | "desc";
};

// ---------------------------------------------------------------------------
// クエリサービス
// ---------------------------------------------------------------------------

/**
 * 指摘の読み取り側クエリサービス。
 */
export type IssueQueryService = {
  /**
   * 指摘の詳細を取得する。
   *
   * @param id - 指摘 ID
   * @returns 指摘の詳細。存在しない場合は `null`
   */
  readonly findById: (id: IssueId) => Promise<IssueDetail | null>;

  /**
   * フィルター条件に一致する指摘の一覧を取得する。
   *
   * @param filters - フィルター条件（省略時は全件取得）
   * @param options - ソート等のクエリ制御オプション
   * @returns 指摘一覧（デフォルト: updatedAt 降順）
   */
  readonly findAll: (
    filters?: IssueFilters,
    options?: QueryOptions,
  ) => Promise<readonly IssueListItem[]>;

  /**
   * 指摘のイベント履歴を取得する。
   *
   * @remarks
   * 監査証跡（タスク#17）で使用する。
   * 「誰が・いつ・何を変えたか」を時系列で確認できる。
   *
   * @param id - 指摘 ID
   * @returns イベント列（version 昇順）
   */
  readonly getEventHistory: (
    id: IssueId,
  ) => Promise<readonly IssueDomainEvent[]>;
};
