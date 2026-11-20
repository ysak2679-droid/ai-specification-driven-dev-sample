---
paths:
  - "app/**/*.html"
  - "app/**/*.css"
  - "app/**/*.js"
---

# Material Design 3 適用ルール

`app/` 配下のファイルを読む・書くときにだけ読み込まれるルール。

## 1. ライブラリ
Material Web（公式 Web Components）を CDN から読み込む。

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&family=Noto+Sans+JP:wght@400;500&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined">
<link rel="stylesheet" href="styles/tokens.css">
<script type="module" src="https://esm.run/@material/web/all.js"></script>
```

## 2. 仕様書の「種別」→ コンポーネント対応表
仕様書の項目定義表にある「種別」を、必ず次のコンポーネントに変換する。

| 仕様書の種別 | 使うコンポーネント |
|---|---|
| テキスト入力 / パスワード入力 / 日付入力 | `<md-outlined-text-field>`（`type` を指定） |
| 複数行入力 | `<md-outlined-text-field type="textarea">` |
| ボタン（主） | `<md-filled-button>` |
| ボタン（副） | `<md-outlined-button>` |
| リンク | `<md-text-button>` |
| アイコンボタン | `<md-icon-button>` + `<md-icon>` |
| FAB | `<md-fab>` |
| タブ | `<md-tabs>` + `<md-primary-tab>` |
| リスト | `<md-list>` + `<md-list-item>` |
| チェック | `<md-checkbox>` |
| ラジオ | `<md-radio>` |
| 上部バー | `<header class="top-app-bar">`（下記トークンで装飾） |
| 一時メッセージ | `<div class="snackbar">`（inverse-surface 色、画面下部） |
| アコーディオン（開閉する質問・項目） | `<details>` + `<summary>`。`summary` 内に `<md-ripple>` `<md-focus-ring>` と開閉アイコン `<md-icon>`（閉：`add`／開：`remove`） |

- ネイティブの `<button>` `<input>` `<select>` `<textarea>` は使わない。
- 入力エラーは text-field の `error` / `error-text` 属性で表示する。
- 必須項目は `required`、文字数制限は `maxlength` と `supporting-text` のカウンタで表現する。

## 3. 色・タイポグラフィ・形状（デザイントークン）
- 色は **必ず** `var(--md-sys-color-*)` で参照する。カラーコードの直書き禁止。
- トークンの定義は `app/styles/tokens.css` の1か所だけに置く（シードカラー `#6750A4`）。
- フォントは `Roboto, "Noto Sans JP", sans-serif`。
- 余白は 4px の倍数（8 / 16 / 24 …）。
- 角丸は `--md-sys-shape-corner-*` を使う。

`app/styles/tokens.css` に最低限含めるトークン：

```css
:root {
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EADDFF;
  --md-sys-color-surface: #FEF7FF;
  --md-sys-color-on-surface: #1D1B20;
  --md-sys-color-surface-container: #F3EDF7;
  --md-sys-color-outline: #79747E;
  --md-sys-color-error: #B3261E;
  --md-sys-color-inverse-surface: #322F35;
  --md-sys-color-inverse-on-surface: #F5EFF7;
  --md-sys-shape-corner-medium: 12px;
  --md-ref-typeface-brand: Roboto, "Noto Sans JP", sans-serif;
  --md-ref-typeface-plain: Roboto, "Noto Sans JP", sans-serif;
}
```

## 4. 共通の振る舞い
- アコーディオンは **複数同時に開ける**（1つ開いても他は閉じない）。
- アコーディオンの初期表示は **すべて閉じた状態**。仕様書の画像で開いて描かれている項目は「開いたときの見本」とみなす。
- 仕様書に文言が無い箇所（例：回答文が未記載）は、`spec-reviews/` で AI確認OK の「修正内容」があればそれを使う。無ければ文章を創作せず「（仕様書に未記載）」と表示し、報告で一覧にする。
- AI確認OK の「修正内容」が上記の振る舞い（初期表示など）と異なる指定をしている場合は、修正内容を優先する。

## 5. レイアウト
- モバイルファースト。本文の最大幅は 600px で中央寄せ。
- 上部バーの高さは 64px、背景 `surface-container`。
