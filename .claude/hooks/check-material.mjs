// PostToolUse フック：app/ 配下のファイルが書き込まれるたびに Material Design ルール違反を検査する。
// 違反があれば exit 2 で終了し、stderr の内容が Claude に返されて修正が促される。
import { readFileSync, existsSync } from "node:fs";
import { relative, extname } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const rel = relative(projectDir, filePath).replaceAll("\\", "/");
const ext = extname(rel);
if (!rel.startsWith("app/") || ![".html", ".css", ".js"].includes(ext)) process.exit(0);

const text = readFileSync(filePath, "utf8");
const lines = text.split(/\r?\n/);
const errors = [];

// 1. ネイティブのフォーム部品を禁止（Material Web の md-* を使う）
if (ext === ".html") {
  lines.forEach((line, i) => {
    const m = line.match(/<(button|input|select|textarea)\b/i);
    if (m) errors.push(`${rel}:${i + 1} ネイティブ要素 <${m[1]}> は禁止。対応表の md-* コンポーネントを使うこと`);
  });
  if (/<html[\s>]/i.test(text) && !text.includes("@material/web")) {
    errors.push(`${rel} Material Web (@material/web) が読み込まれていない`);
  }
}

// 2. カラーコード直書きを禁止（トークン定義ファイルだけは例外）
if (rel !== "app/styles/tokens.css") {
  lines.forEach((line, i) => {
    if (/(color|background|border|fill|stroke|shadow)[\w-]*\s*[:=]\s*[^;]*(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/i.test(line)) {
      errors.push(`${rel}:${i + 1} 色の直書きは禁止。var(--md-sys-color-*) を使うこと → ${line.trim()}`);
    }
  });
}

if (errors.length) {
  console.error("Material Design ルール違反（.claude/rules/material-design.md）:\n- " + errors.join("\n- "));
  process.exit(2);
}
