# Feature PR Template

Used by: `/workflow:feature`

## PR Title Format

```
feat: {変更内容}
```

## PR Body Template

```markdown
## 概要

{変更内容の要約}

## 関連Issue

Closes #{issue番号}

## 変更内容

- {変更点1}
- {変更点2}

## テスト

- [ ] pnpm test
- [ ] pnpm lint
- [ ] pnpm format
- [ ] pnpm build

## スクリーンショット（該当する場合）

{スクリーンショット}
```

## Commit Message Format

```
feat: {変更内容の要約}

Closes #{issue番号}

{詳細な変更内容}
```

## gh pr create Example

```bash
gh pr create \
  --title "feat: {変更内容}" \
  --body "$(cat <<EOF
## 概要
{変更内容の要約}

## 関連Issue
Closes #{issue番号}

## 変更内容
- {変更点1}
- {変更点2}

## テスト
- [ ] pnpm test
- [ ] pnpm lint
- [ ] pnpm format
- [ ] pnpm build

## スクリーンショット（該当する場合）
{スクリーンショット}
EOF
)"
```
