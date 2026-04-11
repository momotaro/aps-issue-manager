import { describe, expect, it } from "vitest";
import type { UserCompany } from "@/lib/mock-users";
import type { IssueStatus } from "@/types/issue";
import {
  type ComposerAction,
  type ComposerMode,
  getComposerActionBarState,
} from "./composer.hooks";

type Case = {
  name: string;
  mode: ComposerMode;
  status: IssueStatus | null;
  company: UserCompany;
  expectedHidden: boolean;
  expectedActions: readonly ComposerAction[];
  expectedCanAttachPhoto: boolean;
  expectedWaitingHint: string | null;
};

/**
 * Composer ActionBar マトリクス。
 *
 * | mode | status        | user        | hidden | 期待ボタン              | waitingHint          |
 * |------|---------------|-------------|--------|-------------------------|----------------------|
 * | add  | -             | supervisor  | false  | [submit]                | null                 |
 * | add  | -             | contractor  | false  | [submit]                | null                 |
 * | edit | open          | supervisor  | false  | [comment]               | 協力会社の作業開始待ち |
 * | edit | open          | contractor  | false  | [comment, start]        | null                 |
 * | edit | in_progress   | supervisor  | false  | [comment]               | 協力会社の是正対応待ち |
 * | edit | in_progress   | contractor  | false  | [comment, correct]      | null                 |
 * | edit | in_review     | supervisor  | false  | [reject, approve]       | null                 |
 * | edit | in_review     | contractor  | false  | [comment]               | 監督会社のレビュー待ち |
 * | edit | done          | supervisor  | true   | []                      | null                 |
 * | edit | done          | contractor  | true   | []                      | null                 |
 */
const cases: Case[] = [
  {
    name: "add モード / supervisor → [submit]",
    mode: "add",
    status: null,
    company: "supervisor",
    expectedHidden: false,
    expectedActions: ["submit"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: null,
  },
  {
    name: "add モード / contractor → [submit]",
    mode: "add",
    status: null,
    company: "contractor",
    expectedHidden: false,
    expectedActions: ["submit"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: null,
  },
  {
    name: "edit / open / supervisor → [comment] + 作業開始待ちヒント",
    mode: "edit",
    status: "open",
    company: "supervisor",
    expectedHidden: false,
    expectedActions: ["comment"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: "協力会社の作業開始待ちです",
  },
  {
    name: "edit / open / contractor → [comment, start]",
    mode: "edit",
    status: "open",
    company: "contractor",
    expectedHidden: false,
    expectedActions: ["comment", "start"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: null,
  },
  {
    name: "edit / in_progress / supervisor → [comment] + 是正対応待ちヒント",
    mode: "edit",
    status: "in_progress",
    company: "supervisor",
    expectedHidden: false,
    expectedActions: ["comment"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: "協力会社の是正対応待ちです",
  },
  {
    name: "edit / in_progress / contractor → [comment, correct]",
    mode: "edit",
    status: "in_progress",
    company: "contractor",
    expectedHidden: false,
    expectedActions: ["comment", "correct"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: null,
  },
  {
    name: "edit / in_review / supervisor → [reject, approve] (写真添付不可)",
    mode: "edit",
    status: "in_review",
    company: "supervisor",
    expectedHidden: false,
    expectedActions: ["reject", "approve"],
    expectedCanAttachPhoto: false,
    expectedWaitingHint: null,
  },
  {
    name: "edit / in_review / contractor → [comment] + レビュー待ちヒント",
    mode: "edit",
    status: "in_review",
    company: "contractor",
    expectedHidden: false,
    expectedActions: ["comment"],
    expectedCanAttachPhoto: true,
    expectedWaitingHint: "監督会社のレビュー待ちです",
  },
  {
    name: "edit / done / supervisor → hidden (完了済み)",
    mode: "edit",
    status: "done",
    company: "supervisor",
    expectedHidden: true,
    expectedActions: [],
    expectedCanAttachPhoto: false,
    expectedWaitingHint: null,
  },
  {
    name: "edit / done / contractor → hidden (完了済み)",
    mode: "edit",
    status: "done",
    company: "contractor",
    expectedHidden: true,
    expectedActions: [],
    expectedCanAttachPhoto: false,
    expectedWaitingHint: null,
  },
];

describe("getComposerActionBarState マトリクス", () => {
  it.each(cases)("$name", ({
    mode,
    status,
    company,
    expectedHidden,
    expectedActions,
    expectedCanAttachPhoto,
    expectedWaitingHint,
  }) => {
    const result = getComposerActionBarState({ mode, status, company });
    expect(result.hidden).toBe(expectedHidden);
    expect(result.actions).toEqual(expectedActions);
    expect(result.canAttachPhoto).toBe(expectedCanAttachPhoto);
    expect(result.waitingHint).toBe(expectedWaitingHint);
  });

  it("status が null の edit モードはコメントのみ表示（ヒントなし）", () => {
    const result = getComposerActionBarState({
      mode: "edit",
      status: null,
      company: "supervisor",
    });
    expect(result.hidden).toBe(false);
    expect(result.actions).toEqual(["comment"]);
    expect(result.canAttachPhoto).toBe(true);
    expect(result.waitingHint).toBeNull();
  });
});
