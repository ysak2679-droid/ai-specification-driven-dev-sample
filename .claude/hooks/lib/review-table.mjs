// spec-reviews/*.md（仕様書確認一覧）の読み取りと、フック共通の判定処理。
import { relative, isAbsolute, resolve } from "node:path";

export const COLUMNS = ["No", "重大度", "チェックID", "箇所", "不備の内容", "実装時の扱い", "修正提案", "修正状態", "修正内容"];
export const STATUSES = ["未修正", "修正済AI未確認", "AI確認NG", "AI確認OK"];

// プロジェクト相対パス（/ 区切り）に変換する
export function toRel(projectDir, path) {
  const abs = isAbsolute(path) ? path : resolve(projectDir, path);
  return relative(projectDir, abs).replaceAll("\\", "/");
}

// Markdown 表の1行をセルに分割する（\| はセル内の文字として扱う）
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

// 一覧表を読み取る。戻り値：{ header: string[] | null, rows: Record<列名, 値>[] }
export function parseReview(text) {
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => /^\s*\|/.test(l) && splitRow(l)[0] === "No" && splitRow(l).includes("修正状態"));
  if (hi < 0) return { header: null, rows: [] };
  const header = splitRow(lines[hi]);
  const rows = [];
  for (let i = hi + 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    const cells = splitRow(lines[i]);
    rows.push(Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""])));
  }
  return { header, rows };
}

export const isError = (row) => row["重大度"].replaceAll("*", "").trim() === "エラー";

// シェルコマンドが folder 配下を変更しうるか（読み取り系は通す）
export function isDestructiveShell(cmd, folder) {
  const F = String.raw`["']?(?:\.[\\/])?` + folder + String.raw`(?:[\\/][^\s"'|;&>]*)?["']?`;
  const mentions = new RegExp(String.raw`(^|[\s"'=(])` + F + String.raw`(?=$|[\s|;&)])`, "i").test(cmd)
    || new RegExp(String.raw`[\\/]` + folder + String.raw`([\\/]|\b)`, "i").test(cmd);
  if (!mentions) return false;
  const patterns = [
    /\b(rm|rmdir|mv|touch|truncate|shred|unlink|chmod)\b/i,
    /\bsed\b[^|;&]*\s-i/i, /\bperl\b[^|;&]*\s-i/i,
    /\btee\b/i,
    new RegExp(String.raw`>{1,2}\s*` + F, "i"),
    new RegExp(String.raw`\b(cp|Copy-Item|copy)\b[^|;&]*\s` + F + String.raw`\s*($|[|;&])`, "i"),
    /\b(Remove-Item|Move-Item|Rename-Item|Set-Content|Add-Content|Clear-Content|Out-File|New-Item|del|erase|ren|move)\b/i,
    /\bgit\s+(rm|mv|checkout|restore|reset|clean|stash)\b/i,
  ];
  return patterns.some((re) => re.test(cmd));
}
