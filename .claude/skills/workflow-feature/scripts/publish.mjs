#!/usr/bin/env node

/**
 * publish.mjs
 *
 * Phase 10 の一括実行スクリプト。
 * コミット → プッシュ → PR 作成 → Project チケットを「In review」に移動。
 *
 * Usage:
 *   node .claude/skills/workflow-feature/scripts/publish.mjs <issue番号> \
 *     --commit-message "feat: ..." \
 *     --pr-title "feat: ..." \
 *     --pr-body-file /tmp/pr-body.md
 *
 * Options:
 *   --commit-message  コミットメッセージ（必須）
 *   --pr-title        PR タイトル（必須）
 *   --pr-body-file    PR ボディを記載したファイルパス（必須）
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

// --- 引数パース ---

const issueNumber = process.argv[2];

if (!issueNumber || !/^\d+$/.test(issueNumber)) {
  console.error(
    "Usage: node publish.mjs <issue番号> --commit-message '...' --pr-title '...' --pr-body-file <path>",
  );
  process.exit(1);
}

const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    "commit-message": { type: "string" },
    "pr-title": { type: "string" },
    "pr-body-file": { type: "string" },
  },
  strict: false,
});

const commitMessage = values["commit-message"];
const prTitle = values["pr-title"];
const prBodyFile = values["pr-body-file"];

if (!commitMessage || !prTitle || !prBodyFile) {
  console.error(
    "Error: --commit-message, --pr-title, --pr-body-file are all required.",
  );
  process.exit(1);
}

const prBody = readFileSync(prBodyFile, "utf-8");

// --- ユーティリティ ---

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf-8",
      timeout: 60_000,
      ...opts,
    }).trim();
  } catch (error) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    console.error(error.message);
    process.exit(1);
  }
}

function runGhGraphQL(query, fields = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(fields)) {
    const flag = typeof value === "number" ? "-F" : "-f";
    args.push(flag, `${key}=${value}`);
  }
  const result = run("gh", args);
  return JSON.parse(result);
}

// --- Step 1: コミット ---

console.log("📝 Committing changes...");

run("git", ["add", "-A"]);

try {
  execFileSync("git", ["diff", "--cached", "--quiet"], { encoding: "utf-8" });
  console.error("Error: No staged changes to commit.");
  process.exit(1);
} catch {
  // diff --quiet は差分がある場合に非ゼロで終了する（= 正常）
}

run("git", ["commit", "-m", commitMessage]);
console.log("✓ Committed");

// --- Step 2: プッシュ ---

console.log("🚀 Pushing to remote...");

const branch = run("git", ["branch", "--show-current"]);
run("git", ["push", "-u", "origin", branch]);
console.log(`✓ Pushed to origin/${branch}`);

// --- Step 3: PR 作成 ---

console.log("📋 Creating pull request...");

const prUrl = run("gh", [
  "pr",
  "create",
  "--title",
  prTitle,
  "--body",
  prBody,
]);
console.log(`✓ PR created: ${prUrl}`);

// --- Step 4: Project チケットを In review に移動 ---

console.log("📌 Updating project ticket status...");

const repo = JSON.parse(run("gh", ["repo", "view", "--json", "owner,name"]));
const owner = repo.owner.login;
const repoName = repo.name;

const query = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      projectItems(first: 10) {
        nodes {
          id
          project {
            id
            title
            field(name: "Status") {
              ... on ProjectV2SingleSelectField {
                id
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const result = runGhGraphQL(query, {
  owner,
  repo: repoName,
  number: Number(issueNumber),
});

const projectItems = result.data.repository.issue.projectItems.nodes;

if (projectItems.length === 0) {
  console.warn(
    `⚠ Issue #${issueNumber} is not linked to any project. Skipping status update.`,
  );
} else {
  for (const item of projectItems) {
    const statusField = item.project.field;
    if (!statusField) {
      console.warn(
        `⚠ Project "${item.project.title}" has no Status field. Skipping.`,
      );
      continue;
    }

    const inReviewOption = statusField.options.find(
      (o) => o.name.toLowerCase() === "in review",
    );
    if (!inReviewOption) {
      console.warn(
        `⚠ Project "${item.project.title}" has no "In review" status option. Skipping.`,
      );
      continue;
    }

    const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }`;

    runGhGraphQL(mutation, {
      projectId: item.project.id,
      itemId: item.id,
      fieldId: statusField.id,
      optionId: inReviewOption.id,
    });

    console.log(
      `✓ Issue #${issueNumber} → "In review" in project "${item.project.title}"`,
    );
  }
}

console.log("\n🎉 Publish complete!");
