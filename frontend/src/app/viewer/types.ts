export type IssueStatus = "open" | "in_progress" | "in_review" | "done";

export type IssueCategory =
  | "quality_defect"
  | "safety_hazard"
  | "construction_defect"
  | "design_change";

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

export interface IssuePin {
  id: string;
  title: string;
  status: IssueStatus;
  category: IssueCategory;
  worldPosition: { x: number; y: number; z: number };
  photoCount: number;
}
