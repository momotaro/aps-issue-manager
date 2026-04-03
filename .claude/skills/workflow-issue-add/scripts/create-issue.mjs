#!/usr/bin/env node

/**
 * create-issue.mjs
 *
 * GitHub Issue を作成し、GitHub Projects に追加する。
 * Issue body は stdin から読み取る。
 *
 * Usage:
 *   echo '<body>' | node create-issue.mjs --title "<title>" [--label feature]
 *
 * Output:
 *   結果 JSON を stdout に出力
 */

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1];
}

const title = getArg("title");
const label = getArg("label");

if (!title) {
  console.error("Usage: echo '<body>' | node create-issue.mjs --title \"<title>\" [--label feature]");
  console.error("Example: echo '## Issue body' | node create-issue.mjs --title \"指摘一覧のフィルター機能\" --label feature");
  process.exit(1);
}

/**
 * gh CLI コマンドを実行し、結果を返す
 */
function runGh(args, options = {}) {
  try {
    return execFileSync("gh", args, {
      encoding: "utf-8",
      timeout: 30_000,
      ...options,
    });
  } catch (error) {
    console.error(`gh command failed: gh ${args.join(" ")}`);
    console.error(error.message);
    process.exit(1);
  }
}

// --- メイン処理 ---

// stdin から Issue body を読み取る
const chunks = [];
const { stdin } = process;
stdin.setEncoding("utf-8");

const bodyPromise = new Promise((resolve) => {
  if (stdin.isTTY) {
    resolve("");
    return;
  }
  stdin.on("data", (chunk) => chunks.push(chunk));
  stdin.on("end", () => resolve(chunks.join("")));
});

const issueBody = await bodyPromise;

if (!issueBody.trim()) {
  console.error("Error: Issue body is empty. Pipe the body via stdin.");
  process.exit(1);
}

// Step 1: Issue を作成
const createArgs = ["issue", "create", "--title", title, "--body", issueBody];
if (label) {
  createArgs.push("--label", label);
}

const createResult = runGh(createArgs);
const issueUrl = createResult.trim();

// Issue 番号を URL から抽出
const issueNumberMatch = issueUrl.match(/\/issues\/(\d+)$/);
if (!issueNumberMatch) {
  console.error(`Error: Could not extract issue number from URL: ${issueUrl}`);
  process.exit(1);
}
const issueNumber = Number.parseInt(issueNumberMatch[1], 10);

// Step 2: GitHub Projects #4 に追加
let projectItemId = null;
try {
  const projectResult = runGh([
    "project",
    "item-add",
    "4",
    "--owner",
    "@me",
    "--url",
    issueUrl,
    "--format",
    "json",
  ]);
  const projectData = JSON.parse(projectResult);
  projectItemId = projectData.id || null;
} catch (error) {
  // Projects 追加に失敗しても Issue 自体は作成済みなので続行
  console.error(`Warning: Failed to add to GitHub Projects: ${error.message}`);
}

// 結果を出力
const output = {
  issueNumber,
  issueUrl,
  projectItemId,
};

console.log(JSON.stringify(output, null, 2));
