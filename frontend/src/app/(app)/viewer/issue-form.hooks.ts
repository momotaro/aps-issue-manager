"use client";

/**
 * IssueForm のロジックフック。
 *
 * @remarks
 * Add モードと Edit モードで扱うフィールドが異なる:
 * - **Add モード**: title / category / assigneeId + 初回コメント（必須）
 * - **Edit モード**: title / category / assigneeId のみ（コメントは Composer 経由）
 *
 * `description` / `photos` / `status` は #34 でスキーマから廃止された。
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ISSUE_CATEGORIES, type IssueCategory } from "@/types/issue";

const baseIssueFields = {
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(200, "タイトルは200文字以内で入力してください"),
  category: z.enum(ISSUE_CATEGORIES),
  assigneeId: z.union([z.string(), z.null()]),
};

/** Edit モード: メタ情報のみ。 */
const editIssueFormSchema = z.object(baseIssueFields);

/** Add モード: メタ情報 + 初回コメント（必須）。 */
const addIssueFormSchema = z.object({
  ...baseIssueFields,
  initialComment: z
    .string()
    .trim()
    .min(1, "初回コメントは必須です")
    .max(2000, "コメントは2000文字以内で入力してください"),
});

export type EditIssueFormValues = z.infer<typeof editIssueFormSchema>;
export type AddIssueFormValues = z.infer<typeof addIssueFormSchema>;

export type IssueFormInitialValues = {
  title?: string;
  category?: IssueCategory;
  assigneeId?: string | null;
};

export function useEditIssueForm(
  isOpen: boolean,
  initialValues?: IssueFormInitialValues,
  resetKey?: string | null,
) {
  const form = useForm<EditIssueFormValues>({
    resolver: zodResolver(editIssueFormSchema),
    defaultValues: {
      title: "",
      category: "quality_defect",
      assigneeId: null,
    },
  });

  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey はリセットトリガーとして意図的に依存配列に含める
  useEffect(() => {
    if (!isOpen) return;
    const vals = initialValuesRef.current;
    form.reset({
      title: vals?.title ?? "",
      category: vals?.category ?? "quality_defect",
      assigneeId: vals?.assigneeId ?? null,
    });
  }, [isOpen, resetKey, form.reset]);

  return form;
}

export function useAddIssueForm(
  isOpen: boolean,
  initialValues?: IssueFormInitialValues,
) {
  const form = useForm<AddIssueFormValues>({
    resolver: zodResolver(addIssueFormSchema),
    defaultValues: {
      title: "",
      category: "quality_defect",
      assigneeId: null,
      initialComment: "",
    },
  });

  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  useEffect(() => {
    if (!isOpen) return;
    const vals = initialValuesRef.current;
    form.reset({
      title: vals?.title ?? "",
      category: vals?.category ?? "quality_defect",
      assigneeId: vals?.assigneeId ?? null,
      initialComment: "",
    });
  }, [isOpen, form.reset]);

  // 部材名が後から取得された場合、タイトルが空であれば自動入力
  useEffect(() => {
    if (isOpen && initialValues?.title) {
      const currentTitle = form.getValues("title");
      if (!currentTitle) form.setValue("title", initialValues.title);
    }
  }, [isOpen, initialValues?.title, form]);

  return form;
}
