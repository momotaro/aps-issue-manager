"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CATEGORY_LABELS, type IssueCategory } from "./types";

const issueFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "タイトルは必須です")
    .max(200, "タイトルは200文字以内で入力してください"),
  description: z.string(),
  category: z.enum([
    "quality_defect",
    "safety_hazard",
    "construction_defect",
    "design_change",
  ]),
});

export type IssueFormValues = z.infer<typeof issueFormSchema>;

interface IssueFormPanelProps {
  isOpen: boolean;
  defaultTitle?: string;
  onSubmit: (data: IssueFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function IssueFormPanel({
  isOpen,
  defaultTitle = "",
  onSubmit,
  onCancel,
  isSubmitting = false,
}: IssueFormPanelProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "quality_defect",
    },
  });

  useEffect(() => {
    if (isOpen)
      reset({
        title: defaultTitle,
        description: "",
        category: "quality_defect",
      });
  }, [isOpen, defaultTitle, reset]);

  return (
    <div
      className={`fixed top-14 right-0 bottom-0 w-80 bg-white border-l border-zinc-200 shadow-xl z-30 transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">指摘を追加</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            className="text-zinc-400 hover:text-zinc-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-label="閉じる"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label
              htmlFor="issue-title"
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              タイトル<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              id="issue-title"
              type="text"
              {...register("title")}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="指摘の内容を入力"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="issue-description"
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              説明
            </label>
            <textarea
              id="issue-description"
              {...register("description")}
              rows={4}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
              placeholder="詳細な説明（任意）"
            />
          </div>

          <div>
            <label
              htmlFor="issue-category"
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              種別<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              id="issue-category"
              {...register("category")}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              {(
                Object.entries(CATEGORY_LABELS) as [IssueCategory, string][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-red-500">
                {errors.category.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "作成中..." : "作成"}
          </button>
        </div>
      </form>
    </div>
  );
}
