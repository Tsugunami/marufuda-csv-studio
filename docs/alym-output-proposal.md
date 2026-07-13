# alym（ラベル屋さん™ テンプレート）出力 実装提案（改訂版）

## 基本方針

- テンプレートの特定は **ラベルサイズではなく「列数×行数」（blockCols×blockRows）** で行う
- ラベル内のテキストは **均等割付＋センター揃え**、各行でフォントサイズ統一
- フォントサイズは自動調整ではなく **固定サイズ指定**で出力
- 差し込みデータ（`rowDataArray`）にグリッドのラベルデータをマッピング

## 対応する4つのテンプレート

| # | ラベルサイズ | 配置 | 面数 | 製品コード | 用紙フォーマット |
|---|---|---|---|---|---|
| ① | 20×20mm | 7列×10行 | 70面 | 31555 | F70A4-1 |
| ② | 35×12mm | 5列×19行 | 95面 | 28790 | F95A4-1 |
| ③ | 20×8mm | 8列×25行 | 200面 | （調査中） | （調査中） |
| ④ | 30×30mm | 5列×8行 | 40面 | （調査中） | （調査中） |

> ③と④については製品コードを調査中（alymテンプレートがあれば解析可能）。

## レイアウトパラメータ（テンプレートごと）

### ① 20×20mm / 70面（F70A4-1）

| 項目 | 値 |
|---|---|
| 用紙 | A4 (210×297mm) |
| 左余白 | 23mm |
| 上余白 | 30.5mm |
| ラベル間パディング | 4mm（水平・垂直） |
| 角丸 | 2mm |
| 使用可能横幅 | 20 - 0.66*2 ≈ **18.67mm**（テキスト） |
| 使用可能高さ | **20mm**（ラベル全体） |
| 標準行数 | 7行 |

### ② 35×12mm / 95面（F95A4-1）

| 項目 | 値 |
|---|---|
| 用紙 | A4 (210×297mm) |
| 左余白 | 13.5mm |
| 上余白 | 16.5mm |
| ラベル間パディング | 2mm（水平・垂直） |
| 角丸 | 2mm |
| 使用可能横幅 | 35 - 1.48*2 ≈ **32.04mm**（テキスト） |
| 使用可能高さ | **12mm**（ラベル全体） |
| 標準行数 | 5行 |

## フォントサイズ計算式

ラベル内でテキストを均等に配置するため、以下の計算でフォントサイズを決定する。

### 1行あたりの高さ

```
rowHeight = labelHeight / itemsPerLabel
```

例：
- 20×20mm / 7行 → 20 / 7 ≈ **2.857mm**
- 35×12mm / 5行 → 12 / 5 = **2.4mm**

### フォントサイズ（pt → mm 換算）

フォントサイズは 1pt ≈ 0.3528mm として計算。
行高さに対して余裕を持たせたサイズを設定する（行高の約60〜70%）。

```
fontSize_pt = rowHeight_mm / 0.3528 * 0.65
```

例：
- 20×20mm / 7行 → rowHeight=2.857mm → 2.857 / 0.3528 * 0.65 ≈ **5.26pt → 実測ベースで7.5pt相当**
- 35×12mm / 5行 → rowHeight=2.4mm → 2.4 / 0.3528 * 0.65 ≈ **4.42pt → 実測ベースで14pt相当**

> ただし実際の alym ではフォントサイズは **7.5（20mmテンプレ）** や **14（35mmテンプレ）** など実測値に基づく数値が使われている。
> よって実装時は以下のルールを適用：

| 行数 | 20×20mm の場合のfontSize | 35×12mm の場合のfontSize |
|---|---|---|
| 4行 | 10 | 16 |
| 5行 | 9 | **14**（標準） |
| 6行 | 8 | 12 |
| 7行 | **7.5**（標準） | 10 |
| 8行 | 6.5 | 9 |

**基本ルール**: `fontSize = min(ラベル横幅_mm / 3, ラベル高_mm / 行数 * 0.65 / 0.3528)`
ただし、実際の見た目と差し込み印刷の互換性を考慮し、各テンプレートごとに固定の標準fontSizeを定義しておくのが安全。

### テキストオブジェクトのY位置

各行を上から均等に配置する：

```
objectY[i] = i * rowHeight + (rowHeight - objectHeight) / 2
```

または簡易的に：

```
objectY[i] = i * (labelHeight / itemsPerLabel)   （0始まり、上端からのオフセット）
```

### テキストオブジェクトの幅・高さ

```
objectWidth = labelWidth - 左右の余白（実測ベースで約0.66〜1.48mmずつ）
objectHeight = rowHeight * 0.8  （行高の80%、上下に少し余白）
```

## JSON生成の構造

```json
{
  "fileVersion": 6,
  "fileEnvironment": "1.5.4",
  "productName": "A4判 70面 四辺余白付 角丸",
  "productCode": "31555",
  "productId": 568,
  "productRegion": "JP",
  "paperCode": "31555",
  "paperFormatCode": "F70A4-1",
  "pageWidth": 210,
  "pageHeight": 297,
  "frameNumber": 70,
  "pageList": [{
    "width": 210,
    "height": 297,
    "designMaxNumber": 70,
    "surfaces": [{
      "width": 210,
      "height": 297,
      "frameArray": [{
        "leftMargin": 23,
        "topMargin": 30.5,
        "horizontalPadding": 4,
        "verticalPadding": 4,
        "width": 20,
        "height": 20,
        "col": 7,
        "row": 10,
        "shape": {
          "type": 0,
          "cornerRadius": 2
        }
      }],
      "designMap": {
        "0": {
          "width": 20,
          "height": 20,
          "layer": {
            "layers": [
              /* 行数分のテキストレイヤーを動的生成 */
            ]
          }
        }
      },
      "insertionData": {
        "insertionDirection": 0,
        "startRow": 0,
        "endRow": 70,
        "columnDataArray": [
          /* 行数分の列定義（A, B, C, ...） */
        ],
        "rowDataArray": [
          /* グリッドデータから変換したラベル行（70行分） */
        ]
      }
    }]
  }]
}
```

## alym出力のワークフロー

```
丸札CSVスタジオ
  │ 現在のレイアウト設定を取得
  │ blockCols×blockRows → テンプレート選択（①〜④）
  │ itemsPerLabel → テキストレイヤー生成
  │ grid.labels → rowDataArray に変換
  ↓
JSON（document.data）を構築
  ↓
ZIP圧縮（document/document.data）
  ↓
.alym 拡張子で保存
  ↓
ユーザーがダブルクリック
  → ラベル屋さん™ 起動 → テンプレート＋データ読み込み済み → 印刷可能
```

## 実装アプローチ

### Step 1: テンプレートJSONのひな型をRust側に持つ

各製品ごとのベースJSON（`rowDataArray` が空状態）を Rust のバイナリに埋め込む。

```rust
// src-tauri/src/alym_template.rs
const TEMPLATE_70: &str = include_str!("../templates/70_20mm.json");
const TEMPLATE_95: &str = include_str!("../templates/95_35mm.json");
```

### Step 2: フロントエンドからグリッドデータを受け取る

```rust
#[tauri::command]
fn export_alym(rows: Vec<Vec<String>>, layout: AlymLayoutInfo) -> Result<String, String> {
    // blockCols×blockRows に応じてテンプレートを選択
    // rows を rowDataArray に変換
    // JSONに埋め込んでZIP圧縮
    // .alym ファイルとして保存
}
```

### Step 3: テキストレイヤー生成

`itemsPerLabel`（行数）に応じて以下の値を動的に計算：

| パラメータ | 計算方法 |
|---|---|
| `fontSize` | テンプレート×行数の組み合わせテーブルから取得 |
| `objectY` | `i * (labelHeight / itemsPerLabel)` で均等配置 |
| `objectWidth` | `labelWidth - 1.5`（余白） |
| `objectHeight` | `labelHeight / itemsPerLabel * 0.8` |
| `columnDataArray` | itemsPerLabel 個の列定義（A,B,C,...） |

## 課題・TODO

1. ❓ **③20×8mm / 200面、④30×30mm / 40面の製品コード調査**
   - ラベル屋さん™ の製品カタログから該当する用紙を特定する必要がある
   - または同様の.alymテンプレートを入手して解析する

2. ❓ **フォントの指定**
   - 現在のテンプレートでは `"noto-sans-jp-400"` が使われている
   - ラベル屋さんでこのフォントが利用可能か要確認
   - 代替としてシステム標準フォント（MS Gothic等）の指定も検討

3. ❓ **デリミタ「～」の扱い**
   - CSV出力時と同様、デリミタ行は空文字として `rowDataArray` に保存
   - ラベル屋さんの差し込みで「～」を補完するか、明示的にテキストとして持たせるか検討

4. ❓ **空ラベルの扱い**
   - 未使用ラベルは空行として出力（`isPrint: true` の空文字データ）
   - 印刷時にスキップするかどうかはラベル屋さん側の設定次第

5. ❓ **ファイル名**
   - 現在のCSV出力と同様に、設定されたファイル名を.alymのベース名として使用
   - 例: `筑紫ヶ丘_伝送.alym`

alym ファイルは **ZIPアーカイブ** で、内部に以下の構成を持つ：

```
document/
  document.data    ← JSON（テンプレート情報＋差し込みデータ）
```

### document.data の主要フィールド

| カテゴリ | フィールド | 説明 | 出所 |
|---|---|---|---|
| **製品情報** | `productCode` | 製品コード（例: 28790） | プリセットに紐づく固定値 |
| | `productName` | 製品名（例: A4 95面 四辺余白付角丸） | 固定値 |
| | `productId` | 製品ID | 固定値 |
| | `paperCode` | 用紙コード | 固定値 |
| | `paperFormatCode` | フォーマットコード | 固定値 |
| **用紙** | `pageWidth` / `pageHeight` | A4 = 210×297mm | 固定値 |
| | `frameNumber` | 総ラベル数 | 固定値 |
| **ラベルフレーム** | `frameArray[].width` / `height` | ラベルサイズ（mm） | 固定値 |
| | `leftMargin` / `topMargin` | 用紙余白 | 固定値 |
| | `horizontalPadding` / `verticalPadding` | ラベル間パディング | 固定値 |
| | `col` / `row` | 配置（列×行） | 固定値 |
| | `shape.cornerRadius` | 角丸（2mm） | 固定値 |
| **テキストレイヤー** | `layers[].text` | 初期テキスト（項目1〜項目N） | 行数に応じて動的生成 |
| | `layers[].objectY` | 各行のY位置 | 行数に応じて計算 |
| | `layers[].baseTextInfo.fontSize` | フォントサイズ | 行数に応じて調整 |
| | `layers[].baseTextInfo.fontId` | フォント | 固定値 |
| **差し込みデータ** | `insertionData.columnDataArray` | 列定義（挿入ID・ヘッダ） | 行数分動的生成 |
| | `insertionData.rowDataArray` | ラベルデータ配列 | **グリッドデータから変換** |
| | `rowDataArray[].cellDataArray[].content` | 各セルのテキスト | グリッドの各行テキスト |

## 実装方針（案）

### アプローチA: テンプレートJSONをRust側に内蔵（推奨）

各製品コードごとの `document.data` のひな型JSONをRustバイナリに埋め込み、
差し込みデータ部分（`rowDataArray`）だけを動的に書き換えて出力する。

**メリット**:
- フロントエンドの変更が最小限
- 出力が高速
- テンプレートの追加が容易（JSONファイルを追加するだけ）

**デメリット**:
- 製品ごとのテンプレートJSONを事前に用意する必要がある
- バイナリサイズが若干増加

### アプローチB: フロントエンドでJSON構築

フロントエンド（TypeScript）で `document.data` のJSONを構築し、
Rust側ではZIP圧縮のみ行う。

**メリット**:
- テンプレートJSONを動的に生成できる
- Rust側の変更が少ない

**デメリット**:
- フロントエンドのコードが複雑化
- 製品ごとのレイアウトパラメータをフロント側でも持つ必要がある

## 必要な製品テンプレート一覧（現状のプリセット対応）

| プリセット名 | 製品コード | ラベルサイズ | 面数 | 配置 | 行数 |
|---|---|---|---|---|---|
| A4 95面 四辺余白付角丸 | 28790 | 35×12mm | 95面 | 5×19 | 5行 |
| A4 70面 四辺余白付角丸 | 31555 | 20×20mm | 70面 | 7×10 | 7行 |
| （その他プリセット） | ... | ... | ... | ... | ... |

## 出力UI（案）

現在のCSV出力バーに「alym出力」ボタンを追加する方式がシンプル。

```
[CSV出力実行] [alym出力]  40 ラベル / Shift-JIS
```

または、出力形式を選択するドロップダウン：

```
[出力実行 ▼]  40 ラベル
 ├ CSV (Shift-JIS)
 ├ CSV (UTF-8 BOM)
 ├ CSV (UTF-8)
 └ alym (ラベル屋さんテンプレート)
```

## ワークフロー

```
丸札CSVスタジオ
  ↓ alym出力
.alym ファイル
  ↓ ダブルクリック
ラベル屋さん™ 起動
  → テンプレート読み込み済み
  → 差し込みデータ反映済み
  ↓ 印刷実行
ラベル用紙に印刷完了
```

## 課題・検討事項

1. **製品コードの特定**: 現在のレイアウト設定（blockCols×blockRows、ラベルサイズ）から
   対応する製品コードを自動判定するロジックが必要
2. **フォントサイズの自動調整**: 行数に応じてテキストがラベルに収まるよう
   フォントサイズを計算する必要がある
3. **デリミタ「～」の扱い**: CSV出力と同様に、デリミタ行は空文字として保存し、
   ラベル屋さん側で表示させる方式を検討
4. **テンプレートJSONの管理**: 新製品に対応するたびにテンプレートJSONを追加する運用
