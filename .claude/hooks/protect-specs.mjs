// PreToolUse フック：specs/（仕様書）への書き込み・削除・移動をツール実行前にブロックする。
// permissions の deny は Edit/Write しか止められないため、Bash / PowerShell 経由の変更もここで防ぐ。
// ブロック時は exit 2。stderr の内容が Claude に返される。
import { readFileSync } from "node:fs";
import { toRel, isDestructiveShell } from "./lib/review-table.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name ?? "";
const params = input.tool_input ?? {};
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

function block(reason) {
  console.error(
    `仕様書保護：${reason}\n` +
    "specs/ は読み取り専用です。仕様書の不備は /check-spec で spec-reviews/ に一覧化し、修正は「修正提案」として示してください。"
  );
  process.exit(2);
}

// 1. ファイル編集系ツール
const filePath = params.file_path ?? params.notebook_path ?? params.path;
if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool) && filePath) {
  const rel = toRel(projectDir, filePath);
  if (rel === "specs" || rel.startsWith("specs/")) block(`${tool} で ${filePath} を変更しようとしました。`);
}

// 2. シェル経由の変更
if (/^(Bash|PowerShell)$/.test(tool) && typeof params.command === "string" && isDestructiveShell(params.command, "specs")) {
  block(`specs/ を変更する可能性のあるコマンドを検出しました → ${params.command}`);
}

process.exit(0);
