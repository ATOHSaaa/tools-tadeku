# Aozora Style（Chrome拡張）

青空文庫の本文ページに、縦書き・ゴシック・余白などのスタイルを適用します。

## インストール（開発版）

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」
4. この `extension` フォルダを選択

## Chrome Web Store 申請用 ZIP

```bash
./scripts/build-aozora-extension.sh
```

`aozora-style/dist/aozora-style-v{version}.zip` が生成されます。

### ストア掲載時に使う URL

| 項目 | URL |
|------|-----|
| ホームページ | https://tools.tadeku.net/aozora-style/ |
| プライバシーポリシー | https://tools.tadeku.net/aozora-style/privacy.html |

### 権限の説明（審査用メモ）

- **storage** — 表示設定を端末内に保存するため
- **host_permissions** — 青空文庫の作品本文ページにのみスタイルを適用するため

## 使い方

1. [青空文庫](https://www.aozora.gr.jp/) の作品本文（`cards/.../files/...html`）を開く
2. 画面右下の **Ao** ボタンを押してパネルを開く（もう一度押すと閉じる）
3. スライダーを動かして調整（設定は自動保存）

## 対象ページ

- `https://www.aozora.gr.jp/cards/*/files/*`

作品一覧や作家ページには適用されません。

## ファイル構成

- `manifest.json` — 拡張の定義
- `icons/` — ストア用アイコン
- `panel.js` / `panel.css` — 画面右下のフローティングUI
- `content.js` — ページへの CSS 注入
- `settings.js` — 設定値と CSS 生成（プレビューツールと共有）
