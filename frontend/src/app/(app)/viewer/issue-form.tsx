"use client";

/**
 * IssueForm — IssuePanel の上部に配置するメタ情報フォーム。
 *
 * @remarks
 * 表示モード:
 * - **Add**: title / category / assigneeId + 初回コメント（Composer 側で入力）
 * - **Edit**: title / category / assigneeId のみ
 *
 * `description` / `photos` / `status` は #34 でスキーマから廃止済み。
 * ステータス遷移は Composer の ActionBar から `correctIssue` / `reviewIssue` 経由で行う。
 */

import type {
  FieldError,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { MOCK_USERS } from "@/lib/mock-users";
import { CATEGORY_LABELS, type IssueCategory } from "./types";

type Form = {
  title: string;
  category: IssueCategory;
  assigneeId: string | null;
};

type IssueFormProps = {
  register: UseFormRegister<Form>;
  watch: UseFormWatch<Form>;
  setValue: UseFormSetValue<Form>;
  errors: Partial<Record<keyof Form, FieldError>>;
  /** Add モードではタイトル必須ラベルを表示、Edit モードでも同様。 */
  mode: "add" | "edit";
};

export function IssueForm({
  register,
  watch,
  setValue,
  errors,
}: IssueFormProps) {
  const assigneeId = watch("assigneeId");

  return (
    <div className="flex flex-col gap-3 p-4 border-b border-zinc-200">
      {/* TitleField */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="issue-title"
          className="text-xs font-medium text-zinc-600"
        >
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="issue-title"
          type="text"
          {...register("title")}
          className="h-9 rounded-md border border-zinc-200 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          placeholder="指摘のタイトル"
        />
        {errors.title && (
          <p className="text-[11px] text-red-500">{errors.title.message}</p>
        )}
      </div>

      {/* CategoryField */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="issue-category"
          className="text-xs font-medium text-zinc-600"
        >
          種別 <span className="text-red-500">*</span>
        </label>
        <select
          id="issue-category"
          {...register("category")}
          className="h-9 rounded-md border border-zinc-200 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* AssigneeField */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="issue-assignee"
          className="text-xs font-medium text-zinc-600"
        >
          担当
        </label>
        <select
          id="issue-assignee"
          value={assigneeId ?? ""}
          onChange={(e) =>
            setValue(
              "assigneeId",
              e.target.value === "" ? null : e.target.value,
            )
          }
          className="h-9 rounded-md border border-zinc-200 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
          <option value="">未割当</option>
          {MOCK_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
