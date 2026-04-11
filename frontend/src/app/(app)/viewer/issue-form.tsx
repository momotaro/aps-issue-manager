"use client";

/**
 * IssueForm — IssuePanel の上部に配置するメタ情報フォーム。
 *
 * @remarks
 * 表示モード:
 * - **Add**: title / category + 初回コメント（Composer 側で入力）
 * - **Edit**: title / category のみ（コメントは Composer 経由）
 *
 * `description` / `photos` / `status` は #34 でスキーマから廃止済み。
 * ステータス遷移は Composer の ActionBar から `correctIssue` / `reviewIssue` 経由で行う。
 */

import type { FieldError, UseFormRegister } from "react-hook-form";
import { CATEGORY_LABELS, type IssueCategory } from "./types";

type Form = {
  title: string;
  category: IssueCategory;
  assigneeId: string | null;
};

type IssueFormProps = {
  register: UseFormRegister<Form>;
  errors: Partial<Record<keyof Form, FieldError>>;
  /** Add モードではタイトル必須ラベルを表示、Edit モードでも同様。 */
  mode: "add" | "edit";
  /** true のとき全フィールドを読み取り専用にする。 */
  readOnly?: boolean;
};

export function IssueForm({ register, errors, readOnly }: IssueFormProps) {
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
          readOnly={readOnly}
          className="h-9 rounded-md border border-zinc-200 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900/10 read-only:bg-zinc-50 read-only:cursor-default"
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
          disabled={readOnly}
          className="h-9 rounded-md border border-zinc-200 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-50 disabled:cursor-default disabled:text-zinc-500"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
