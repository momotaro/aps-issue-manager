"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PhotoPhase } from "@/repositories/issue-repository";

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

export function useIssueForm(isOpen: boolean, defaultTitle: string) {
  const form = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "quality_defect",
    },
  });

  const [photoPhase, setPhotoPhase] = useState<PhotoPhase>("before");

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: defaultTitle,
        description: "",
        category: "quality_defect",
      });
      setPhotoPhase("before");
    }
  }, [isOpen, defaultTitle, form.reset]);

  return {
    form,
    photoPhase,
    setPhotoPhase,
  };
}
