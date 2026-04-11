import type { IssueCategory, IssueStatus } from "@/types/issue";

export {
  CATEGORY_LABELS,
  type IssueCategory,
  type IssueStatus,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/types/issue";

export interface IssuePin {
  id: string;
  title: string;
  status: IssueStatus;
  category: IssueCategory;
  worldPosition: { x: number; y: number; z: number };
}
