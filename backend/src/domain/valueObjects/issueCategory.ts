/**
 * 指摘の種別（カテゴリ）を表す値オブジェクト。
 *
 * @remarks
 * 施工現場で発生する指摘を分類するための種別。
 * フィルタリングや集計に使用する。
 */

/** 指摘の種別を表す定数タプル。 */
export const ISSUE_CATEGORIES = [
  /** 品質不良 */
  "quality_defect",
  /** 安全不備 */
  "safety_hazard",
  /** 施工不備 */
  "construction_defect",
  /** 設計変更 */
  "design_change",
] as const;

/** 指摘の種別。 */
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/**
 * 値が有効な IssueCategory かどうかを判定する型ガード。
 *
 * @param value - 検証する値
 */
export const isIssueCategory = (value: unknown): value is IssueCategory =>
  typeof value === "string" &&
  ISSUE_CATEGORIES.includes(value as IssueCategory);
