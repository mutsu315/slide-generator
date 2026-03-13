# スライド生成システム — 仕様書

## 概要
原稿テキストからAI画像生成を活用してプレゼンテーションスライドを自動生成するWebアプリケーション。

## システム構成

### 技術スタック
- **フロントエンド**: React 19 + Vite 6
- **スタイリング**: Tailwind CSS v4（グラスモーフィズムUI）
- **永続化**: IndexedDB（キャラクター画像）、localStorage（設定）
- **画像合成**: HTML Canvas API
- **デプロイ**: GitHub Pages（GitHub Actions CI/CD）

### 対応AIプロバイダー
| プロバイダー | LLMモデル | 画像生成モデル |
|---|---|---|
| Google | Gemini 2.5 Flash / Pro | Nano Banana Pro, Nano Banana 2, Nano Banana, Imagen 3, Imagen 3 Fast |
| OpenAI | GPT-4o, GPT-4o mini, GPT-4.1 | DALL-E 3, DALL-E 2 |

## 処理フロー

```
原稿入力 → [---IMAGE---]タグで分割 → 各スライドについて:
  1. LLMでYAMLプロンプト生成（キャラ画像＋役割情報付き）
  2. 画像生成APIで背景画像を生成
  3. Canvas APIでテキストを合成
     - テキストが1枚に収まらない場合は同じ背景で自動分割
  4. 完成スライド画像を表示
```

## スライドデザインルール

### スライド1（タイトル）
- 左右分割（左: 白背景＋テキスト / 右: AI生成背景＋キャラクター）
- 左上に「Memo.」表示
- タイトルは大きいフォントで中央配置
- リスト項目の数字は赤文字
- 右側に箇条書きがあればチェックマーク付きで表示

### スライド2以降（コンテンツ）
- 全面AI生成背景画像
- 黒グラデーション（40%透過）オーバーレイ
- 白テキストボックス（角丸なし・影なし）を左側に配置
- フォント: ユーザー選択可（7種類 × 4ウェイト）

## テキスト自動分割
- 1枚に収まらないテキストは段落単位で自動分割
- 同じ背景画像を使い回してページ番号表示（例: [1/3]）

## テキスト編集・再合成
- 各スライドにマウスホバーで「編集」ボタン表示
- テキスト編集後「再合成」で背景はそのままテキストのみ再描画

## キャラクター機能
- 複数キャラクター画像をIndexedDBに永続保存
- 複数同時選択可能（クリックでトグル、最低1体は維持）
- 各キャラクターに個別の役割・指示を設定可能
- 役割情報はLLMプロンプトと画像生成プロンプトの両方に反映

## ダウンロード
- 各スライドの個別ダウンロード（PNG）
- 全スライドZIP一括ダウンロード（JSZip使用）

## ファイル構成
```
slide-generator/
├── index.html              # エントリポイント（Google Fonts読み込み）
├── package.json
├── vite.config.js          # base: '/slide-generator/'
├── src/
│   ├── main.jsx
│   ├── index.css           # Tailwind + グラスモーフィズムCSS
│   ├── App.jsx             # メインコンポーネント・パイプライン制御
│   ├── components/
│   │   ├── Sidebar.jsx     # 設定パネル（API・モデル・フォント・キャラ）
│   │   ├── ScriptInput.jsx # 原稿入力（タグ挿入・スライド数表示）
│   │   └── OutputFeed.jsx  # 結果表示（編集・DL・ZIP）
│   └── lib/
│       ├── engine.js       # AI API連携（LLM + 画像生成）
│       ├── compositor.js   # Canvas合成（タイトル/コンテンツ/分割）
│       └── storage.js      # IndexedDB操作
└── .github/workflows/
    └── deploy.yml          # GitHub Pages自動デプロイ
```

## API仕様

### runPipeline(options)
| パラメータ | 型 | 説明 |
|---|---|---|
| apiKey | string | APIキー |
| script | string | 原稿テキスト |
| aspectRatio | string | アスペクト比（デフォルト: 16:9） |
| model | string | 画像生成モデルID |
| llmModel | string | LLMモデルID |
| provider | string | 'google' or 'openai' |
| characterDescription | string | キャラクター指示テキスト |
| characterImageDataUrls | string[] | キャラクター画像のdata URL配列 |
| abortController | AbortController | 中断制御 |
| onProgress | function | 進捗コールバック |

### 進捗イベント
| type | 説明 |
|---|---|
| start | 生成開始（total: スライド数） |
| slide-start | スライド処理開始（step: yaml/image） |
| yaml-complete | YAMLプロンプト生成完了 |
| slide-complete | スライド1枚の背景画像完成 |
| error | エラー発生 |
| stopped | ユーザーによる中断 |
| done | 全スライド完了 |
