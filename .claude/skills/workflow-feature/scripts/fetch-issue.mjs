#!/usr/bin/env node

/**
 * fetch-issue.mjs
 *
 * GitHub Issue を取得し、構造化 JSON を stdout に出力する。
 * Issue テンプレート (docs/templates/issue_feature.md) の構造に基づいてパースする。
 *
 * Usage:
 *   node .claude/skills/workflow-feature/scripts/fetch-issue.mjs <issue番号>
 *
 * Output:
 *   構造化 JSON を stdout に出力
 */

import { execFileSync } from "node:child_process";

const issueNumber = process.argv[2];

if (!issueNumber || !/^\d+$/.test(issueNumber)) {
  console.error("Usage: node fetch-issue.mjs <issue番号>");
  console.error("Example: node fetch-issue.mjs 42");
  process.exit(1);
}

/**
 * gh CLI コマンドを実行し、JSON を返す
 */
function runGh(args) {
  try {
    const result = execFileSync("gh", args, {
      encoding: "utf-8",
      timeout: 30_000,
    });
    return JSON.parse(result);
  } catch (error) {
    console.error(`gh command failed: gh ${args.join(" ")}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Issue 本文からセクションを検出する
 */
function detectSection(body, pattern) {
  return pattern.test(body);
}

/**
 * 「完了の定義」セクションからチェックリスト項目を抽出する
 */
function extractDefinitionOfDone(body) {
  const sectionMatch = body.match(
    /###\s*⚙️\s*完了の定義([\s\S]*?)(?=\n---|\n##\s|$)/,
  );
  if (!sectionMatch) return [];

  const sectionContent = sectionMatch[1];
  const items = [];
  for (const line of sectionContent.split("\n")) {
    const match = line.match(/^\s*-\s*\[[ x]\]\s*(.+)/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  return items;
}

/**
 * 「デザイン」セクションから .pen ファイルパスを抽出する
 */
function extractPenFiles(body) {
  const sectionMatch = body.match(
    /##\s*🎨\s*デザイン([\s\S]*?)(?=\n---|\n##\s|$)/,
  );
  if (!sectionMatch) return [];

  const sectionContent = sectionMatch[1];
  const penFiles = [];
  const penRegex = /`([^`]+\.pen)`/g;
  let match;
  while ((match = penRegex.exec(sectionContent)) !== null) {
    penFiles.push(match[1]);
  }
  return penFiles;
}

/**
 * テーブル形式のタスクセクションからタスクを抽出する
 */
function extractTasks(body, sectionPattern) {
  const sectionMatch = body.match(sectionPattern);
  if (!sectionMatch) return [];

  const sectionContent = sectionMatch[1];
  const tasks = [];
  for (const line of sectionContent.split("\n")) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|?\s*$/);
    if (match) {
      tasks.push({
        no: Number.parseInt(match[1], 10),
        content: match[2].trim(),
      });
    }
  }
  return tasks;
}

// --- メイン処理 ---

const fields =
  "number,title,body,state,labels,assignees,milestone,url,createdAt,updatedAt";
const issue = runGh([
  "issue",
  "view",
  issueNumber,
  "--json",
  fields,
]);

const comments = runGh([
  "issue",
  "view",
  issueNumber,
  "--json",
  "comments",
]);

const body = issue.body || "";

const hasBackendTasks = detectSection(
  body,
  /##\s*🛠️\s*バックエンド/,
);
const hasFrontendTasks = detectSection(
  body,
  /##\s*🖥️\s*フロントエンド/,
);

const definitionOfDone = extractDefinitionOfDone(body);
const penFiles = extractPenFiles(body);

const backendTasks = hasBackendTasks
  ? extractTasks(
      body,
      /##\s*🛠️\s*バックエンド[\s\S]*?\n([\s\S]*?)(?=\n---|\n##\s*🖥️|\n##\s*🎨|\n##\s*📝|$)/,
    )
  : [];

const frontendTasks = hasFrontendTasks
  ? extractTasks(
      body,
      /##\s*🖥️\s*フロントエンド[\s\S]*?\n([\s\S]*?)(?=\n---|\n##\s*🎨|\n##\s*📝|$)/,
    )
  : [];

const output = {
  issue: {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    labels: (issue.labels || []).map((l) => l.name),
    assignees: (issue.assignees || []).map((a) => a.login),
    milestone: issue.milestone?.title || null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    body,
    comments: (comments.comments || []).map((c) => ({
      author: c.author?.login || "unknown",
      body: c.body,
      createdAt: c.createdAt,
    })),
  },
  analysis: {
    hasBackendTasks,
    hasFrontendTasks,
    definitionOfDone,
    penFiles,
    backendTasks,
    frontendTasks,
  },
};

console.log(JSON.stringify(output, null, 2));
