/**
 * ISO 8601 文字列を `M/D HH:mm` 形式にフォーマットする。
 *
 * @remarks クライアントのローカルタイムゾーンに依存する。
 * `CommentItemView` の既存実装と意図的に同じ挙動にしている。
 *
 * @example
 * // TZ=UTC 環境では "4/10 14:32"
 * formatDateTime("2026-04-10T14:32:00.000Z")
 */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
