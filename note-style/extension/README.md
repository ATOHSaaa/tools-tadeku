# Note Style（Chrome拡張）

note の記事ページに、縦書き・ゴシック・余白などのスタイルを適用します。

## インストール（開発版）

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」
4. この `extension` フォルダを選択

## 使い方

1. [note](https://note.com/) の記事（`/{username}/n/{noteKey}`）を開く
2. 画面右下の **Nt** ボタンを押してパネルを開く（もう一度押すと閉じる）
3. スライダーを動かして調整（設定は自動保存）

## 対象ページ

- `https://note.com/*/n/*`

トップ・マガジン一覧・プロフィールなどには適用されません。

## ファイル構成

- `manifest.json` — 拡張の定義
- `panel.js` / `panel.css` — 画面右下のフローティングUI
- `popup.html` / `popup.js` / `popup.css` — 旧ポップアップUI（未使用）
- `content.js` — ページへの CSS 注入（SPA遷移にも追従）
- `settings.js` — 設定値と CSS 生成
