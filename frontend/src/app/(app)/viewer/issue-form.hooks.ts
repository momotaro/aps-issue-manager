"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PhotoPhase } from "@/repositories/issue-repository";
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  type IssueCategory,
  type IssueStatus,
} from "@/types/issue";

const issueFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "タイトルは必須です")
    .max(200, "タイトルは200文字以内で入力してください"),
  description: z.string(),
  category: z.enum(ISSUE_CATEGORIES),
  status: z.enum(ISSUE_STATUSES).optional(),
});

export type IssueFormValues = z.infer<typeof issueFormSchema>;

export type IssueFormInitialValues = {
  title?: string;
  description?: string;
  category?: IssueCategory;
  status?: IssueStatus;
};

export function useIssueForm(
  isOpen: boolean,
  mode: "create" | "edit",
  initialValues?: IssueFormInitialValues,
  resetKey?: string | null,
) {
  const form = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "quality_defect",
    },
  });

  const [photoPhase, setPhotoPhase] = useState<PhotoPhase>("before");

  // Use ref so the effect doesn't re-run when object reference changes mid-session
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  useEffect(() => {
    if (isOpen) {
      const vals = initialValuesRef.current;
      if (mode === "edit" && vals) {
        form.reset({
          title: vals.title ?? "",
          description: vals.description ?? "",
          category: vals.category ?? "quality_defect",
          status: vals.status,
        });
      } else {
        form.reset({
          title: vals?.title ?? "",
          description: "",
          category: "quality_defect",
        });
      }
      setPhotoPhase("before");
    }
  }, [isOpen, mode, resetKey, form.reset]);

  // 部材名が非同期で取得された場合、タイトルが空であれば自動入力する
  useEffect(() => {
    if (isOpen && mode === "create" && initialValues?.title) {
      const currentTitle = form.getValues("title");
      if (!currentTitle) {
        form.setValue("title", initialValues.title);
      }
    }
  }, [isOpen, mode, initialValues?.title, form]);

  return {
    form,
    photoPhase,
    setPhotoPhase,
  };
}
