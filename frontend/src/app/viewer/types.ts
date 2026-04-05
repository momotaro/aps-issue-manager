export type IssueStatus = "open" | "in_progress" | "in_review" | "done";

export type IssueCategory =
  | "quality_defect"
  | "safety_hazard"
  | "construction_defect"
  | "design_change";

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
