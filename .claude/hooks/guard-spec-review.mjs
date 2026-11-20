// PreToolUse フック：spec-reviews/（仕様書確認一覧）を AI が書き換えるときのルールを強制する。
//  - 「修正内容」列はユーザー専用。AI は変更できない
//  - AI確認OK の行は確定済み。どの列も変更できない
//  - 「修正済AI未確認」にするのはユーザーだけ。AI は 修正済AI未確認 → AI確認OK / AI確認NG のみ変更できる
//  - 行の削除は禁止。新しい行は 未修正・修正内容空欄 で追加する
//  - シェルから確認一覧（*.md）を変更するのは禁止（Edit / Write ツールを使う）
// 違反時は exit 2 でブロックし、理由を Claude に返す。
import { readFileSync, existsSync } from "node:fs";
import { COLUMNS, STATUSES, parseReview, toRel, isDestructiveShell } from "./lib/review-table.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name ?? "";
const params = input.tool_input ?? {};
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

function block(reason) {
  console.error(
    `仕様書確認一覧の保護：${reason}\n` +
    "AI が変更できるのは、修正状態（修正済AI未確認 → AI確認OK／AI確認NG）・修正提案・行の追加・表の外（集計など）だけです。"
  );
  process.exit(2);
}

// コマンドが確認一覧（spec-reviews 内の *.md、ワイルドカード、フォルダ全体）を対象にしているか
function targetsReviewList(cmd) {
  const paths = cmd.match(/spec-reviews(?:[\\/][^\s"'|;&>)]*)?/gi) ?? [];
  return paths.some((p) => {
    const rest = p.replace(/^spec-reviews[\\/]?/i, "");
    return rest === "" || /\.md$/i.test(rest) || rest.includes("*");
  });
}

// シェル経由で確認一覧を変更するのは禁止（編集画面などの md 以外のファイルは対象外）
if (/^(Bash|PowerShell)$/.test(tool)) {
  const cmd = params.command;
  if (typeof cmd === "string" && isDestructiveShell(cmd, "spec-reviews") && targetsReviewList(cmd)) {
    block(`シェルから spec-reviews/ の確認一覧を変更しようとしました → ${cmd}`);
  }
  process.exit(0);
}

const filePath = params.file_path;
if (!/^(Write|Edit|MultiEdit)$/.test(tool) || !filePath) process.exit(0);
const rel = toRel(projectDir, filePath);
if (!rel.startsWith("spec-reviews/") || !rel.endsWith(".md")) process.exit(0);

// 変更後の内容を組み立てる
const oldText = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
let newText = oldText;
const applyEdit = (text, e) => {
  if (!text.includes(e.old_string)) return null; // ツール側でエラーになるので判定しない
  return e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
};
if (tool === "Write") newText = params.content ?? "";
if (tool === "Edit") newText = applyEdit(oldText, params);
if (tool === "MultiEdit") for (const e of params.edits ?? []) { if (newText !== null) newText = applyEdit(newText, e); }
if (newText === null) process.exit(0);

const before = parseReview(oldText);
const after = parseReview(newText);

if (!after.header) {
  if (before.header) block("一覧表（No〜修正内容）を削除しようとしました。");
  process.exit(0); // 一覧表を含まない Markdown（説明ファイル等）は対象外
}
if (after.header.join("|") !== COLUMNS.join("|")) {
  block(`表の列は「${COLUMNS.join("／")}」から変更できません。`);
}

const afterByNo = new Map();
for (const row of after.rows) {
  if (afterByNo.has(row.No)) block(`No.${row.No} が重複しています。`);
  if (!STATUSES.includes(row["修正状態"])) block(`No.${row.No} の修正状態「${row["修正状態"]}」は ${STATUSES.join("／")} のいずれかにしてください。`);
  afterByNo.set(row.No, row);
}

const oldNos = new Set();
for (const prev of before.rows) {
  oldNos.add(prev.No);
  const next = afterByNo.get(prev.No);
  if (!next) block(`No.${prev.No} の行を削除しようとしました。`);
  if (next["修正内容"] !== prev["修正内容"]) block(`No.${prev.No} の「修正内容」はユーザー専用の列です。`);
  if (prev["修正状態"] === "AI確認OK" && COLUMNS.some((c) => next[c] !== prev[c])) {
    block(`No.${prev.No} は AI確認OK（確定済み）のため変更できません。`);
  }
  if (next["修正状態"] !== prev["修正状態"]) {
    const ok = prev["修正状態"] === "修正済AI未確認" && ["AI確認OK", "AI確認NG"].includes(next["修正状態"]);
    if (!ok) block(`No.${prev.No} の修正状態を「${prev["修正状態"]}」→「${next["修正状態"]}」に変更できません。AI は「修正済AI未確認」の行だけを AI確認OK／AI確認NG にできます。`);
  }
}

for (const row of after.rows) {
  if (oldNos.has(row.No)) continue;
  if (row["修正状態"] !== "未修正" || row["修正内容"] !== "") {
    block(`新しい行 No.${row.No} は、修正状態「未修正」・修正内容「空欄」で追加してください。`);
  }
}

process.exit(0);
