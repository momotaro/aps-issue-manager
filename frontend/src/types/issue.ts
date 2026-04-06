/**
 * 指摘のステータス・種別定義。
 *
 * Source of truth: backend/src/domain/valueObjects/issueStatus.ts, issueCategory.ts
 * バックエンドのドメイン層が正。値を追加・変更する場合はバックエンド側を先に更新し、
 * ここを同期すること。STATUS_LABELS / CATEGORY_LABELS のキーが網羅されていない場合、
 * TypeScript が Record 型の不足キーとしてコンパイルエラーを出すため検知可能。
 */

export const ISSUE_STATUSES = [
  "open",
  "in_progress",
  "in_review",
  "done",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_CATEGORIES = [
  "quality_defect",
  "safety_hazard",
  "construction_defect",
  "design_change",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  in_review: "レビュー中",
  done: "完了",
};

export const STATUS_COLORS: Record<IssueStatus, { text: string; bg: string }> =
  {
    open: { text: "text-red-600", bg: "bg-red-100" },
    in_progress: { text: "text-yellow-600", bg: "bg-amber-100" },
    in_review: { text: "text-blue-600", bg: "bg-blue-100" },
    done: { text: "text-green-600", bg: "bg-green-100" },
  };

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  quality_defect: "品質不良",
  safety_hazard: "安全不備",
  construction_defect: "施工不備",
  design_change: "設計変更",
};
