# タイプイラスト生成ガイド

物書きへの100の質問（`hyaku`）の16タイプ用アイコン・イラストを、AI画像生成で作る手順。  
NWTF（混沌の創造者）で確立した **2段階生成** を他タイプにも流用できる。

## 前提

- タイプ定義は `shared/hyaku-data.js` の `TYPES` を参照する（`code` / `name` / `blurb` / 4軸）
- 生成物は `hyaku/assets/` に置く
- 診断UIのトンマナ（クリーム背景・茶系アクセント）に合わせる

### デザイントークン（プロンプトにそのまま書ける）

| 用途 | 値 |
|---|---|
| 背景 | `#f0ebe0`（クリーム） |
| 轮廓・文字 | `#1a1814` |
| アクセント（茶） | `#6b4c2a` |
| ゴールド | `#9a7340` / `#c8a030` |

---

## 全体の流れ

```
タイプ定義を読む
    ↓
① タイプから連想される「本イラスト」を生成
    ↓
② ①を参照画像にして「ドラクエのアイコン風」に変換
    ↓
hyaku/assets/ に保存
```

**ポイント:** いきなりドット絵やDQ風を指定しない。まずタイプの意味が伝わるイラストを作り、②でアイコン化する。

---

## Step 1 — タイプから連想される本イラスト

### 入力

- `name`（例: 混沌の創造者）
- `blurb`（タイプ説明文）
- 4軸の意味（N/W/T/F など、タイプごとに強い軸をプロンプトに反映）

### プロンプトの方針

- **やること:** そのタイプの執筆スタイル・雰囲気が一目でわかるシーン、モチーフ、表情
- **やらないこと:** ピクセルアート、レトロゲーム、ドット絵、UI枠、文字・ロゴ
- 画風: 暖色のデジタルイラスト（セピア〜茶、文学ファンタジー寄り）
- 用途: パーソナリティ診断の結果イメージ（カードに載せても読める構図）

### プロンプト例（NWTF）

```
Original illustration for a writer personality type called "Chaos Creator" (混沌の創造者).
A passionate young creator at a desk, mid-burst of inspiration — not pixel art, not retro game style.
Painterly digital illustration with warm cream and sepia tones (#f0ebe0, brown #6b4c2a, muted gold).

The scene: a writer surrounded by a gentle storm of creative chaos — floating miniature worlds
(tiny castles, planets, maps), abstract theme symbols, half-formed sentences and question marks
swirling like ink smoke from their pen. They write furiously with joyful intensity, hair messy,
eyes bright with intuition. Papers scatter with momentum, not neatness.

Mood: wonder, speed, unconventional ideas breaking through. World-building and big themes meet
raw intuitive flow. Literary fantasy, not sci-fi. Soft lighting, expressive character.
No text, no logos, no UI chrome.
```

### 出力ファイル名

```
hyaku/assets/{code小文字}-dq-icon.png
```

Step 1 の `{code}-illust.png` は DQ アイコン生成の参照用。**リポジトリには dq-icon のみ置く**（illust は生成後削除してよい）。

例: `nwtf-dq-icon.png`

---

## Step 2 — ドラクエのアイコン風に変換

### 入力

- **Step 1 の PNG を参照画像（reference）に指定する**
- Step 1 で描いたモチーフを **簡略化して残す**（4個前後のアイコン程度。ごちゃごちゃさせない）

### プロンプトの方針

- 鳥山明 / ドラクエ1（FC）寄りの **太い黒轮廓・ちび比率**
- 正方形・中央配置・**クリーム背景がキャンバス端まで一面**（枠なし）
- バトル／ステータス画面のアイコンとして小さく見ても判別できる
- 写実・油彩風は禁止。レトロRPGアイコン

### 枠の統一（必須）

**すべて枠なし**で揃える。以下は **禁止**:

- 角丸の飾り枠・額縁
- DQ メニュー風の青い UI ウィンドウ
- 内側パネル・二重線ボーダー
- 背景が端まで届いていない「カード状」構図

**正しい例:** `nwtf-dq-icon.png` — キャラとシンボルだけが `#f0ebe0` の平面上に浮いている

再生成時は `nwtf-dq-icon.png` をスタイル参照に加える。

### プロンプト例（NWTF）

```
Dragon Quest game icon / battle sprite style portrait based on the reference illustration.
Transform the chaotic creator writer scene into retro Japanese RPG icon art in
Akira Toriyama / Dragon Quest 1 Famicom aesthetic.

Icon composition (square):
- Chibi young writer with messy hair, excited expression, holding feather quill
- Simplified version of the reference: small swirl of golden creative chaos around head —
  tiny castle, planet with ring, question mark, floating paper (3-4 symbols max)
- Warm sepia-cream palette: cream background #f0ebe0, brown #6b4c2a, gold accents
- Thick black outlines, chunky pixels visible, front-facing heroic pose
- NOT photorealistic, NOT painterly
- Square format, character centered, no text, no UI frame
```

### 参照画像の指定

生成時に Step 1 のファイルパスを reference に渡す（ローカル作業用。コミット不要）:

```
hyaku/assets/scpr-illust.png  （生成後削除可）
```

（Cursor の Generate Image 等で `reference_image_paths` に指定）

### 出力ファイル名

```
hyaku/assets/{code小文字}-dq-icon.png
```

例: `nwtf-dq-icon.png`

---

## 他タイプへ展開するとき

1. `hyaku-data.js` から対象タイプの `blurb` と4文字コードを確認
2. Step 1 のプロンプトで **タイプ名・説明・強い軸に合うモチーフ** に差し替え  
   - 例: SCPR（藍図の工匠）→ 定規・設計図・丁寧に積み上げる机  
   - 例: NCPR（人心の解読者）→ 人物のシルエット・心・虫眼鏡
3. Step 1 を生成 → `assets/` に保存
4. Step 2 で Step 1 を参照して DQ アイコン化
5. 診断結果画面・PNG 出力には **イラスト／アイコンは使わない**（タイプ名・説明・4軸のみ）

### 4軸とモチーフのヒント

| 軸 | 左 | 右 | 視覚モチーフの例 |
|---|---|---|---|
| S/N | 構成・型 | 直感・筆感 | 設計図 ↔ .sparkles・渦 |
| C/W | 人物・心理 | 世界・設定 | 顔・心 ↔ 城・地図・惑星 |
| P/T | 文体・セリフ | テーマ・問い | 羽ペン・原稿 ↔ ？・天秤 |
| R/F | 推敲・磨き | 速度・一気書き | 眼鏡・消しゴム ↔ 風・残像 |

---

## 成果物一覧（16タイプ）

**現状:** 診断 UI では画像アセットを使っていない。以下は生成パイプラインの参考用ファイル名。

| code | タイプ名 | DQアイコン（未使用） |
|---|---|---|
| SCPR | 藍図の工匠 | `scpr-dq-icon.png` |
| SCPF | 疾風の設計者 | `scpf-dq-icon.png` |
| SCTR | 命題の設計者 | `sctr-dq-icon.png` |
| SCTF | 疾風の構成家 | `sctf-dq-icon.png` |
| SWPR | 世界の設計者 | `swpr-dq-icon.png` |
| SWPF | 境界の旅人 | `swpf-dq-icon.png` |
| SWTR | 時代の記録者 | `swtr-dq-icon.png` |
| SWTF | 幻想の建築家 | `swtf-dq-icon.png` |
| NCPR | 人心の解読者 | `ncpr-dq-icon.png` |
| NCPF | 直感の語り部 | `ncpf-dq-icon.png` |
| NCTR | 内省の観察者 | `nctr-dq-icon.png` |
| NCTF | 感情の放浪者 | `nctf-dq-icon.png` |
| NWPR | 言葉の魔術師 | `nwpr-dq-icon.png` |
| NWPF | 夢境の織り手 | `nwpf-dq-icon.png` |
| NWTR | 社会の鏡 | `nwtr-dq-icon.png` |
| NWTF | 混沌の創造者 | `nwtf-dq-icon.png` |

---

## 注意

- 生成結果は毎回微妙に異なる。気に入った版を採用してからコミットする
- ファイルサイズが大きい（数 MB）ことがある。必要なら後処理で圧縮
- **診断 UI には画像を表示しない**（`hyaku/assets/` にアイコン PNG は置かない）
