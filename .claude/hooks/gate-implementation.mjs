// PreToolUse / PostToolUse フック：app/ への書き込みを、仕様書の重大度エラーが解決するまで確認制にする。
// 対象画面の spec-reviews/*.md に「重大度=エラー かつ 修正状態≠AI確認OK」の行があるか、チェック未実施なら、
// PreToolUse で permissionDecision=ask を返し、ユーザーに「本当に修正しますか？」と確認する。
// 一度承認された（＝PostToolUse まで進んだ）未解決エラーの組み合わせは、同じセッションでは再確認しない。
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { parseReview, isError, toRel } from "./lib/review-table.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const params = input.tool_input ?? {};
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const filePath = params.file_path;
if (!filePath || !toRel(projectDir, filePath).startsWith("app/")) process.exit(0);

// 対象の仕様書：ファイル名が SCR-xx で始まればその画面、共通ファイル（styles 等）は全画面
const specsDir = join(projectDir, "specs");
const specs = existsSync(specsDir) ? readdirSync(specsDir).filter((f) => f.toLowerCase().endsWith(".png")) : [];
const id = basename(filePath).match(/^(SCR-\d+)/)?.[1];
const targets = id ? specs.filter((s) => s.startsWith(id)) : specs;

const issues = [];
for (const spec of targets) {
  const name = spec.replace(/\.png$/i, "");
  const reviewPath = join(projectDir, "spec-reviews", `${name}.md`);
  if (!existsSync(reviewPath)) {
    issues.push(`${spec}：仕様書チェック（/check-spec）が未実施`);
    continue;
  }
  for (const row of parseReview(readFileSync(reviewPath, "utf8")).rows) {
    if (isError(row) && row["修正状態"] !== "AI確認OK") {
      issues.push(`${spec} No.${row.No} ${row["チェックID"]} ${row["箇所"]}（${row["修正状態"]}）`);
    }
  }
}
if (issues.length === 0) process.exit(0);

const key = createHash("sha1").update(issues.join("\n")).digest("hex");
const markerDir = join(tmpdir(), "claude-spec-gate");
const marker = join(markerDir, `${input.session_id ?? "unknown"}.txt`);

if (input.hook_event_name === "PostToolUse") {
  // ここまで来た＝ユーザーが承認した。同じ状態では再確認しない
  mkdirSync(markerDir, { recursive: true });
  writeFileSync(marker, key);
  process.exit(0);
}

if (existsSync(marker) && readFileSync(marker, "utf8") === key) process.exit(0);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason:
      "エラーの項目が修正されていません。本当に修正しますか？\n" +
      issues.map((i) => `・${i}`).join("\n") +
      "\n（spec-reviews/ の修正内容を記入し /check-spec で AI確認OK になると、この確認は出なくなります）",
  },
}));
process.exit(0);
