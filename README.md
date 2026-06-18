# tools-tadeku

蓼食う虫式の執筆・創作向け Web ツールをまとめたモノレポです。GitHub Pages で公開しています。

## 公開 URL

- **メイン:** [https://tools.tadeku.net](https://tools.tadeku.net)

各ツールはサブパスから利用できます（例: `https://tools.tadeku.net/stoic/`）。

## 含まれるツール

| ディレクトリ | 説明 |
|-------------|------|
| `pedantryfall/` | PedantryFall — 衒学の滝 |
| `WordFall/` | 物書きのための語彙が降ってくる |
| `stoic/` | 前進専用エディタ |
| `tachometer/` | 執筆速度計測エディタ |
| `Interval/` | 立ち止まりたい人のための執筆エディタ |
| `scene/` | Scene — シーン単位の構成エディタ |

ルートの `index.html` から各ツールへのリンク一覧を表示します。`CNAME` でカスタムドメイン `tools.tadeku.net` を指定しています。

## 旧 URL（引き続き利用可能）

各ツールは従来どおり個別の `*.github.io` リポジトリからも配信されている場合があり、**旧 GitHub Pages の URL も引き続き動作します**。本リポジトリはそれらを一つのサイト（`tools.tadeku.net`）に集約するためのものです。

## ローカル確認

静的サイトのため、ルートで簡易サーバを立てて `index.html` や各サブディレクトリを確認できます。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開いてください。
