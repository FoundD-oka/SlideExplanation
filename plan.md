
YouTube理解サポートスライド生成ツール 実装計画書

このプロジェクトは、YouTube URLまたは動画ファイルを入力し、Gemini APIで動画内容を解析して、OpenAIのgpt-image-2で理解サポート用スライド画像を自動生成するWebアプリとして実装する。

MVPでは、1スライドを1枚の完成画像として生成する。テキスト後載せ、PowerPoint出力、PDF出力、Figma連携、HTML資料化は将来対応にする。

初期版の主導線は以下に固定する。

1. 入力
2. 設定
3. 構成確認・編集
4. 画像生成
5. レビュー
6. 書き出し

サイズ表記はデザイナー仮置きの1920x1080を使わない。UI表示、DB保存値、OpenAI APIに渡すsizeを一致させる。gpt-image-2は条件を満たす任意解像度を受け付け、代表例として2048x1152と3840x2160が公式に示されている。両辺は16pxの倍数である必要があるため、1920x1080はMVPの生成サイズとして採用しない。 ￼

⸻

1. 参照仕様

1.1 Gemini API

Gemini APIは動画理解に対応し、動画の説明、区間分割、情報抽出、質問応答、タイムスタンプ参照ができる。入力方法はFile API、Cloud Storage Registration、Inline Data、YouTube URLに対応している。 ￼

YouTube URL入力は公開YouTube動画向けで、非公開・限定公開動画は対象外。無料枠ではYouTube動画を1日8時間まで扱える。Gemini 2.5以降のモデルでは、1リクエスト最大10本まで動画を扱える。 ￼

動画ファイル入力では、File API uploadが最大2GB per file、プロジェクトあたり最大20GB、保存期間48時間とされている。 ￼

Geminiの対応動画MIME typeには、video/mp4、video/quicktime、video/avi、video/webmなどが含まれる。MVPのUIでは問い合わせを減らすため、MP4 / MOV / AVIを前面に出し、WebMは初期表示しない。 ￼

GeminiはJSON Schemaに沿った構造化出力に対応しているため、スライド構成はJSONで固定して受け取る。 ￼

1.2 OpenAI Image API

OpenAI APIではgpt-image-2を使ってテキストプロンプトから画像生成できる。1プロンプトから1枚の画像を作る用途ではImage APIが適しており、会話型・複数ターン編集の体験ではResponses APIが適している。MVPは1スライド1画像生成なので、Image APIを採用する。 ￼

gpt-image-2のsizeは、最大辺3840px以下、両辺16pxの倍数、長辺と短辺の比率3:1以内、総ピクセル数655,360以上8,294,400以下という条件を満たす必要がある。 ￼

OpenAI公式ドキュメントでは、gpt-image-2の代表サイズとして2048x1152、3840x2160などが示されている。出力品質はlow、medium、high、autoから選べる。2560x1440を超える総ピクセル数の出力はexperimental扱いとされているため、MVPの標準は2048x1152にする。 ￼

GPT Image系モデルには、複雑なプロンプトで処理時間が伸びること、正確な文字描画、複数画像間の一貫性、厳密なレイアウト制御が難しい場合があるという制限がある。MVPではこれを前提に、スライド単位の再生成と指示調整導線を強くする。 ￼

⸻

2. プロダクト概要

2.1 プロダクト名

仮称：Video Slide Assistant

2.2 目的

動画の内容を短時間で理解・復習・共有できるスライド画像に変換する。

2.3 対象ユーザー

* 動画教材を短く理解したい学習者
* YouTube解説動画を資料化したい制作者
* 社内共有用に動画内容を要約したいビジネスユーザー
* 動画からプレゼン資料のたたき台を作りたいユーザー

2.4 MVPで作る価値

単なる動画要約ではなく、以下の4要素を中心に理解サポート資料を作る。

* タイムライン
* 概念図
* 比較図
* 誤解ポイント

クイズ機能は入れない。

⸻

3. MVPスコープ

3.1 MVPで実装する機能

* YouTube URL入力
* 動画ファイルアップロード
* 基本設定
* Gemini APIによる動画解析
* Gemini APIによるスライド構成JSON生成
* 構成確認・編集
* gpt-image-2によるスライド画像生成
* 生成中ステータス表示
* 生成キャンセル
* レビュー
* スライド単位の再生成
* 指示を調整して再生成
* 構成に戻って編集
* ZIP形式で画像一括ダウンロード

3.2 MVPで実装しない機能

* クイズ生成
* PowerPoint出力
* PDF出力
* Figma連携
* HTML資料化
* 画像へのテキスト後載せ
* レイヤー編集
* ブランドテンプレート管理
* 複数ユーザー共同編集
* 動画字幕ファイルの手動アップロード
* 有料決済
* YouTube非公開動画のURL直接解析

3.3 将来対応

* テキスト後載せレイアウト
* PowerPoint出力
* PDF出力
* Figma連携
* HTML資料化
* ブランドガイド反映
* 画像生成スタイルプリセット
* スライドごとの編集レイヤー
* 動画チャプター指定
* 複数動画の統合資料化
* チーム共有
* 決済・プラン制限

⸻

4. 画面フロー

4.1 Step 1：入力

目的は、動画ソースを決めること。

UIは2タブ構成にする。

* YouTube URL
* 動画ファイル

YouTube URLタブではURL入力欄だけを表示する。動画アップロード欄は出さない。

動画ファイルタブではドラッグ＆ドロップ欄だけを表示する。YouTube URL入力欄は出さない。

CTA文言は「解析を開始する」ではなく「設定へ進む」にする。理由は、この画面の次が解析処理ではなく設定画面だから。

YouTube URL欄の補足文は以下にする。

公開YouTube URLのみ対応。限定公開・非公開の動画は、動画ファイルとしてアップロードしてください。

動画アップロード欄の補足文は以下にする。

対応形式：MP4 / MOV / AVI（最大2GB）

4.2 Step 2：設定

目的は、生成されるスライドの基本条件を決めること。

設定項目は以下に絞る。

* スライド枚数
* スライドテーマ
* 生成画像サイズ

スライド枚数

初期値は10枚。

範囲は5〜20枚。

MVPでは、推奨は8〜12枚とする。

対象読者は初学者に固定し、ユーザーには選択させない。

スライドテーマ

選択肢は以下。

* シンプル図解
* 流れ・手順
* 要点マップ
* コマ割り解説
* 比較まとめ

UIではプルダウンではなく、各テーマのサンプル画像、短い説明、向いている動画を表示するカード選択にする。

生成画像サイズ

項目名は「出力サイズ」ではなく「生成画像サイズ」にする。

理由は、MVPではAIが生成した画像をそのままZIP出力するため。ユーザーに見せるサイズ、DBに保存するサイズ、OpenAI APIに渡すサイズを一致させる。

MVPの選択肢は以下。

* 16:9（推奨）2048x1152
* 4:3（標準）1024x768
* 16:9（高解像度）3840x2160

初期選択は「16:9（推奨）2048x1152」。

3840x2160は有効サイズだが高解像度で処理時間・コストが増えやすく、公式ドキュメント上も2560x1440を超える総ピクセル数はexperimental扱いなので、MVPでは任意選択にする。 ￼

4.3 Step 3：構成確認・編集

目的は、画像生成前にAIが作ったスライド構成を確認・修正すること。

各スライドカードには以下を表示する。

* スライド番号
* タイトル
* 説明
* 図解タイプ
* 根拠タイムスタンプ
* 編集アイコン

図解タイプは以下に固定する。

* タイムライン
* 概念図
* 比較図
* 誤解ポイント

「説明ポイント」というラベルは使わない。今回の価値は、ただ説明することではなく、視聴者が理解しづらい箇所や間違えやすい箇所を整理することだから。

この画面でできる操作は以下。

* タイトル編集
* 説明編集
* 図解タイプ変更
* タイムスタンプ編集
* スライド追加
* スライド削除
* 並べ替え
* 構成案の再作成

4.4 Step 4：画像生成

目的は、構成確認済みのスライドごとにgpt-image-2で画像を生成すること。

進行ステップは以下。

* 動画を解析中
* 構成を作成中
* 画像を生成中
* 仕上げ処理中

画像生成中は、パーセンテージよりも現在のスライド番号を主表示にする。

例：

スライド 6/10 を生成中

パーセンテージはサブ表示でよい。

キャンセルボタンの文言は「キャンセル」ではなく「生成をキャンセル」にする。

補足文は以下にする。

この画面を閉じても、バックグラウンドで処理を続けます。

4.5 Step 5：レビュー

目的は、生成済みスライド画像を確認・管理すること。

表示形式は以下。

* サムネイルタブ
* 一覧タブ

レビュー画面でできる操作は以下。

* スライド選択
* 選択中を再生成
* 指示を調整して再生成
* 構成を編集
* 書き出しへ進む

主要CTAは「書き出しへ」にする。

「プロンプト調整して再生成」という文言は使わない。一般ユーザーには「指示を調整して再生成」のほうがわかりやすい。

4.6 Step 6：書き出し

目的は、生成済み画像をZIPでダウンロードすること。

表示内容は以下。

* 生成完了メッセージ
* スライド枚数
* 生成画像サイズ
* ZIP一括ダウンロード
* 将来対応予定の出力形式
* レビューへ戻る
* 別の動画で作る

「最初からやり直す」という文言は使わない。作成済みデータが消えるように見えるため。

将来対応予定の出力形式はdisabled状態で表示する。

* PowerPoint（.pptx）出力：準備中
* PDF出力：準備中
* Figma連携：準備中
* HTML資料化：準備中

⸻

5. 推奨技術スタック

5.1 フロントエンド

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui相当のコンポーネント設計
* ZustandまたはReact Context

5.2 バックエンド

* Next.js API RoutesまたはNode.js API Server
* TypeScript
* Zodによるバリデーション
* Prisma
* PostgreSQL

5.3 非同期処理

* Redis
* BullMQ

画像生成と動画解析は待ち時間が長いため、同期APIで完了まで待たせない。ジョブを作成し、フロントエンドはポーリングまたはServer-Sent Eventsで進捗を取得する。

5.4 ストレージ

* Cloudflare R2、Amazon S3、Google Cloud Storageのいずれか
* 生成画像はオブジェクトストレージへ保存
* ZIPもオブジェクトストレージへ保存
* 署名付きURLでダウンロード

5.5 外部API

* Gemini API
* OpenAI Image API

⸻

6. データモデル

6.1 projects

プロジェクト単位の親テーブル。

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID NULL,
  title TEXT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

source_typeは以下。

* youtube_url
* video_file

statusは以下。

* draft
* source_ready
* structure_generating
* structure_ready
* image_generating
* review_ready
* export_ready
* failed
* cancelled

6.2 video_sources

入力動画の情報を保存する。

CREATE TABLE video_sources (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  source_type TEXT NOT NULL,
  youtube_url TEXT NULL,
  original_filename TEXT NULL,
  mime_type TEXT NULL,
  file_size_bytes BIGINT NULL,
  storage_key TEXT NULL,
  gemini_file_uri TEXT NULL,
  duration_seconds INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

6.3 project_settings

生成設定を保存する。

CREATE TABLE project_settings (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  slide_count INTEGER NOT NULL,
  audience TEXT NOT NULL,
  theme TEXT NOT NULL,
  image_size TEXT NOT NULL,
  image_quality TEXT NOT NULL,
  output_format TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

image_sizeは以下。

* 2048x1152
* 1024x768
* 3840x2160

image_qualityは以下。

* low
* medium
* high

MVPの初期値はmedium。

output_formatはMVPではpng。

6.4 slides

スライド構成と生成状態を保存する。

CREATE TABLE slides (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  slide_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  diagram_type TEXT NOT NULL,
  source_start_seconds INTEGER NULL,
  source_end_seconds INTEGER NULL,
  learning_goal TEXT NOT NULL,
  main_points JSONB NOT NULL,
  visual_concept TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  speaker_notes TEXT NULL,
  misunderstanding_risk TEXT NULL,
  verification_note TEXT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

diagram_typeは以下。

* timeline
* concept_map
* comparison
* misunderstanding

statusは以下。

* draft
* ready_for_generation
* generating
* generated
* failed

6.5 slide_assets

生成済み画像を保存する。

CREATE TABLE slide_assets (
  id UUID PRIMARY KEY,
  slide_id UUID NOT NULL REFERENCES slides(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  format TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  provider_request_id TEXT NULL,
  prompt_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

6.6 jobs

非同期処理の状態を保存する。

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  current_step TEXT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  current_slide_number INTEGER NULL,
  total_slides INTEGER NULL,
  progress_message TEXT NULL,
  error_message TEXT NULL,
  cancelled_at TIMESTAMP NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

job_typeは以下。

* structure_generation
* image_generation
* slide_regeneration
* export_zip

statusは以下。

* queued
* running
* succeeded
* failed
* cancelled

6.7 job_events

ジョブの詳細ログを保存する。

CREATE TABLE job_events (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

6.8 exports

書き出し結果を保存する。

CREATE TABLE exports (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  export_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_size_bytes BIGINT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

export_typeはMVPではzip_imagesのみ。

⸻

7. API設計

7.1 プロジェクト作成

POST /api/projects

Request:

{
  "sourceType": "youtube_url"
}

Response:

{
  "projectId": "uuid"
}

7.2 YouTube URL登録

POST /api/projects/{projectId}/source/youtube

Request:

{
  "youtubeUrl": "https://www.youtube.com/watch?v=..."
}

処理内容:

* URL形式を検証
* YouTubeドメインを検証
* video_sourcesに保存
* projects.statusをsource_readyへ更新

MVPでは、URL登録時点で公開動画かどうかは完全判定しない。Gemini解析時に失敗した場合、エラーとして返す。

7.3 動画アップロードURL発行

POST /api/projects/{projectId}/source/video/upload-url

Request:

{
  "filename": "sample.mp4",
  "mimeType": "video/mp4",
  "fileSizeBytes": 123456789
}

Response:

{
  "uploadUrl": "signed-url",
  "storageKey": "projects/{projectId}/source/sample.mp4"
}

バリデーション:

* fileSizeBytes <= 2000000000
* MIME typeはvideo/mp4、video/quicktime、video/avi
* 拡張子はmp4、mov、avi

2GBぴったりでは境界エラーが起きやすいため、実装上はMAX_VIDEO_UPLOAD_BYTES=2000000000とする。

7.4 動画アップロード完了通知

POST /api/projects/{projectId}/source/video/complete

Request:

{
  "storageKey": "projects/{projectId}/source/sample.mp4",
  "filename": "sample.mp4",
  "mimeType": "video/mp4",
  "fileSizeBytes": 123456789
}

Response:

{
  "sourceId": "uuid",
  "status": "source_ready"
}

7.5 設定保存

PUT /api/projects/{projectId}/settings

Request:

{
  "slideCount": 10,
  "theme": "minimal_infographic",
  "imageSize": "2048x1152",
  "imageQuality": "medium",
  "outputFormat": "png"
}

バリデーション:

* slideCount: 5〜20
* theme: minimal_infographic、timeline_process、concept_mindmap、visual_storyboard、comparison_highlight
* imageSize: 2048x1152、1024x768、3840x2160
* imageQuality: low、medium、high
* outputFormat: png

7.6 構成生成ジョブ開始

POST /api/projects/{projectId}/structure-jobs

Response:

{
  "jobId": "uuid",
  "status": "queued"
}

処理内容:

* jobsにstructure_generationを作成
* Queueへ投入
* WorkerでGemini解析を実行
* 成功時にslidesを作成
* projects.statusをstructure_readyへ更新

7.7 ジョブ状態取得

GET /api/jobs/{jobId}

Response:

{
  "jobId": "uuid",
  "jobType": "image_generation",
  "status": "running",
  "currentStep": "generating_images",
  "progressPercent": 60,
  "currentSlideNumber": 6,
  "totalSlides": 10,
  "progressMessage": "スライド 6/10 を生成中"
}

7.8 ジョブキャンセル

POST /api/jobs/{jobId}/cancel

Response:

{
  "jobId": "uuid",
  "status": "cancelled"
}

処理内容:

* jobs.statusをcancelledへ更新
* Worker側は各スライド生成前にキャンセル状態を確認する
* 進行中の外部APIリクエストそのものは止められない場合があるため、完了後に結果保存をスキップする

7.9 スライド一覧取得

GET /api/projects/{projectId}/slides

Response:

{
  "slides": [
    {
      "id": "uuid",
      "slideNumber": 1,
      "title": "この動画でわかること",
      "description": "全体のゴールを提示する",
      "diagramType": "timeline",
      "sourceStartSeconds": 0,
      "sourceEndSeconds": 80,
      "status": "ready_for_generation"
    }
  ]
}

7.10 スライド更新

PATCH /api/slides/{slideId}

Request:

{
  "title": "全体像をつかむ",
  "description": "この動画の流れを短く整理する",
  "diagramType": "timeline",
  "sourceStartSeconds": 0,
  "sourceEndSeconds": 80
}

処理内容:

* スライド情報を更新
* image_promptを再生成する必要がある場合、内部でプロンプト再生成フラグを立てる

7.11 スライド追加

POST /api/projects/{projectId}/slides

Request:

{
  "insertAfterSlideNumber": 3,
  "title": "補足ポイント",
  "description": "理解の補助になる内容を追加する",
  "diagramType": "concept_map"
}

7.12 スライド削除

DELETE /api/slides/{slideId}

処理内容:

* 対象スライドを削除
* 残りスライドのslide_numberを振り直す

7.13 スライド並べ替え

POST /api/projects/{projectId}/slides/reorder

Request:

{
  "slideIds": ["uuid-1", "uuid-2", "uuid-3"]
}

7.14 画像生成ジョブ開始

POST /api/projects/{projectId}/image-jobs

Response:

{
  "jobId": "uuid",
  "status": "queued"
}

処理内容:

* 構成済みスライドを順番に取得
* 各スライドのimage_promptを使ってOpenAI Image APIへリクエスト
* 生成画像をストレージに保存
* slide_assetsを作成
* slides.statusをgeneratedへ更新
* すべて完了したらprojects.statusをreview_readyへ更新

7.15 選択中スライドを再生成

POST /api/slides/{slideId}/regenerate

Request:

{
  "instruction": null
}

instructionがnullの場合、既存のimage_promptで再生成する。

7.16 指示を調整して再生成

POST /api/slides/{slideId}/regenerate

Request:

{
  "instruction": "もっとシンプルにして、文字を少なくしてください"
}

処理内容:

* 既存のスライド構成と追加指示を使ってimage_promptを更新
* gpt-image-2で再生成
* slide_assets.versionをインクリメントして保存
* レビュー画面では最新版を表示

7.17 ZIP書き出しジョブ開始

POST /api/projects/{projectId}/export-jobs

Request:

{
  "exportType": "zip_images"
}

Response:

{
  "jobId": "uuid"
}

処理内容:

* 最新版のスライド画像を取得
* ファイル名をslide_01.png形式で整える
* ZIP化
* ストレージへ保存
* exportsに保存

7.18 ZIPダウンロードURL取得

GET /api/exports/{exportId}/download-url

Response:

{
  "downloadUrl": "signed-url",
  "expiresInSeconds": 300
}

⸻

8. Gemini解析・構成生成設計

8.1 入力分岐

YouTube URLの場合

Gemini APIへYouTube URLをfile_data.file_uriとして渡す。

動画ファイルの場合

MVPでは、アップロード済みファイルをサーバーからGemini File APIへアップロードする。

処理順は以下。

1. ユーザーがアプリのストレージへ動画をアップロード
2. Workerがストレージから動画を取得
3. WorkerがGemini File APIへアップロード
4. Geminiのfile_uriをvideo_sources.gemini_file_uriに保存
5. file_uriを使って構成生成リクエストを実行

8.2 Gemini出力JSON Schema

{
  "type": "object",
  "required": [
    "video_title",
    "target_audience",
    "core_message",
    "slides"
  ],
  "properties": {
    "video_title": {
      "type": "string"
    },
    "target_audience": {
      "type": "string"
    },
    "core_message": {
      "type": "string"
    },
    "slides": {
      "type": "array",
      "minItems": 5,
      "maxItems": 20,
      "items": {
        "type": "object",
        "required": [
          "slide_number",
          "title",
          "description",
          "diagram_type",
          "learning_goal",
          "source_timestamps",
          "main_points",
          "visual_concept",
          "image_prompt_for_gpt_image_2",
          "speaker_notes",
          "misunderstanding_risk",
          "verification_note"
        ],
        "properties": {
          "slide_number": {
            "type": "integer"
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "diagram_type": {
            "type": "string",
            "enum": [
              "timeline",
              "concept_map",
              "comparison",
              "misunderstanding"
            ]
          },
          "learning_goal": {
            "type": "string"
          },
          "source_timestamps": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "main_points": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "visual_concept": {
            "type": "string"
          },
          "image_prompt_for_gpt_image_2": {
            "type": "string"
          },
          "speaker_notes": {
            "type": "string"
          },
          "misunderstanding_risk": {
            "type": "string"
          },
          "verification_note": {
            "type": "string"
          }
        }
      }
    }
  }
}

8.3 Geminiプロンプト

あなたはYouTube動画・動画教材を、理解サポート用スライドに変換する編集者です。
目的:
動画内容を、視聴者が短時間で理解・復習・共有できるスライド構成に変換してください。
重要:
クイズは作成しないでください。
単なる要約ではなく、理解を助ける資料構成にしてください。
必ず「タイムライン」「概念図」「比較図」「誤解ポイント」のいずれかの図解タイプを各スライドに割り当ててください。
動画で確認できない内容は推測で補完せず、verification_noteに「未確認」と書いてください。
出力条件:
- 日本語で出力
- スライド枚数は指定値に合わせる
- 各スライドは1つの学習ゴールだけにする
- 各スライドに根拠となる動画タイムスタンプを付ける
- 画像生成用プロンプトは英語で書く
- 画像内に長文テキストを入れない
- 事実、推測、補足を混ぜない
- JSON Schemaに完全準拠する
ユーザー設定:
- スライド枚数: {{slide_count}}
- 対象読者: 初学者
- スライドテーマ: {{theme}}
- 生成画像サイズ: {{image_size}}
出力:
JSONのみ。

⸻

9. OpenAI画像生成設計

9.1 採用API

MVPではOpenAI Image APIのimages.generateを使う。

採用理由は、スライド1枚ごとに独立した画像を生成するため。

9.2 画像生成パラメータ

{
  "model": "gpt-image-2",
  "prompt": "{{image_prompt}}",
  "size": "2048x1152",
  "quality": "medium",
  "output_format": "png"
}

9.3 サイズ選択肢

MVPのサイズ選択肢は以下。

[
  {
    "label": "16:9（推奨）2048x1152",
    "value": "2048x1152",
    "default": true
  },
  {
    "label": "4:3（標準）1024x768",
    "value": "1024x768",
    "default": false
  },
  {
    "label": "16:9（高解像度）3840x2160",
    "value": "3840x2160",
    "default": false
  }
]

1024x768はOpenAI公式の代表サイズには載っていないが、両辺16pxの倍数、比率3:1以内、総ピクセル数655,360以上という条件を満たすため採用可能と判断する。根拠はgpt-image-2のサイズ制約。 ￼

9.4 ベースプロンプト

Create a complete educational slide image in a clean modern presentation style.
Canvas:
- Size: {{image_size}}
- Aspect ratio: {{aspect_ratio}}
Slide purpose:
{{learning_goal}}
Slide title:
{{title}}
Content to visualize:
{{main_points}}
Diagram type:
{{diagram_type}}
Visual concept:
{{visual_concept}}
Design requirements:
- The slide must work as a standalone educational slide.
- Use a clear hierarchy with a title, simple visual structure, and concise labels.
- Include only short text. Avoid long paragraphs.
- Make the key idea understandable at a glance.
- Use a polished modern layout suitable for learning materials.
- Keep the background clean and not too busy.
- Avoid logos, watermarks, fake UI screenshots, and tiny unreadable labels.
- Do not add information that is not supported by the provided content.
Theme:
{{theme}}
Audience:
初学者

9.5 図解タイプ別の追加指示

timeline

Use a timeline layout. Show the sequence of key events or steps in order. Make the flow easy to follow.

concept_map

Use a concept map layout. Show the central concept and its relationships to supporting ideas.

comparison

Use a comparison layout. Clearly contrast the two or more items using separated areas.

misunderstanding

Use a misconception clarification layout. Show the common misunderstanding and the corrected understanding in a clear, friendly way.

9.6 生成失敗時のリトライ

リトライ条件:

* 一時的なAPIエラー
* タイムアウト
* ネットワークエラー
* 保存処理エラー

リトライ回数:

* 最大2回

リトライ間隔:

* 1回目：3秒後
* 2回目：10秒後

リトライしても失敗した場合:

* 対象スライドのstatusをfailedにする
* レビュー画面で「再生成」できるようにする
* ジョブ全体は可能な限り継続する

9.7 品質モード

MVPではmediumをデフォルトにする。

理由は、lowは高速な下書き向け、highはコストと待ち時間が増えやすいため。最初から高品質に固定すると、10枚生成時の待ち時間が重くなる。low、medium、highは公式に示されている品質オプション。 ￼

⸻

10. ジョブ処理設計

10.1 structure_generation job

処理順:

1. projects.statusをstructure_generatingへ更新
2. 動画ソースを取得
3. YouTube URLまたはGemini File URIを準備
4. Geminiへ動画解析・構成生成リクエスト
5. JSON Schema検証
6. スライド枚数検証
7. タイムスタンプ形式を秒へ変換
8. slidesへ保存
9. projects.statusをstructure_readyへ更新
10. jobs.statusをsucceededへ更新

失敗時:

* jobs.statusをfailedへ更新
* projects.statusをfailedへ更新
* ユーザーへ原因を表示

10.2 image_generation job

処理順:

1. projects.statusをimage_generatingへ更新
2. 生成対象スライドを取得
3. 各スライドのstatusをgeneratingへ更新
4. OpenAI Image APIへリクエスト
5. base64画像をデコード
6. ストレージへ保存
7. slide_assetsへ保存
8. slides.statusをgeneratedへ更新
9. 進捗を更新
10. 全スライド完了後、projects.statusをreview_readyへ更新

キャンセル時:

* jobs.statusをcancelledへ更新
* 未生成スライドはready_for_generationに戻す
* 生成済みスライドは保持する

10.3 slide_regeneration job

処理順:

1. 対象スライドを取得
2. 追加指示がある場合はimage_promptを更新
3. OpenAI Image APIへリクエスト
4. 新しい画像を保存
5. slide_assets.versionを増やす
6. レビュー画面で最新版を表示

10.4 export_zip job

処理順:

1. 最新版のslide_assetsを取得
2. スライド番号順に並べる
3. 画像を一時ディレクトリへ取得
4. slide_01.png形式にリネーム
5. ZIP化
6. ストレージへ保存
7. exportsへ保存
8. 署名付きURLを発行できる状態にする

⸻

11. UI状態設計

11.1 入力画面

状態:

* idle
* url_entered
* file_selected
* uploading
* uploaded
* error

エラー例:

* URL形式が不正です
* YouTube URLを入力してください
* 対応していない動画形式です
* ファイルサイズは最大2GBまでです
* アップロードに失敗しました

11.2 設定画面

状態:

* ready
* saving
* saved
* error

CTA:

* 構成案を作成する

11.3 構成確認画面

状態:

* generating
* ready
* editing
* saving
* error

CTA:

* 画像を生成する

11.4 画像生成中画面

状態:

* queued
* running
* cancel_requested
* cancelled
* failed
* succeeded

表示メッセージ例:

* 動画を解析中
* 構成を作成中
* スライド 6/10 を生成中
* 仕上げ処理中
* 生成が完了しました

11.5 レビュー画面

状態:

* loading
* ready
* regenerating
* error

CTA:

* 書き出しへ
* 選択中を再生成
* 指示を調整して再生成
* 構成を編集

11.6 書き出し画面

状態:

* ready
* exporting
* export_ready
* error

CTA:

* 画像を一括ダウンロード（ZIP形式）
* レビューへ戻る
* 別の動画で作る

⸻

12. バリデーション設計

12.1 YouTube URL

許可するURL例:

* https://www.youtube.com/watch?v=...
* https://youtu.be/...
* https://www.youtube.com/shorts/...

拒否するURL例:

* YouTube以外のURL
* 空文字
* 不正なURL
* javascript:など危険なスキーム

注意:

* 限定公開・非公開の判定はGeminiリクエスト時に失敗として扱う
* UIには公開動画のみ対応と明記する

12.2 動画ファイル

MVPで許可するMIME type:

* video/mp4
* video/quicktime
* video/avi

MVPで許可する拡張子:

* .mp4
* .mov
* .avi

最大サイズ:

* 2,000,000,000 bytes

Gemini仕様上はWebMも対応しているが、MVPではUIに出さない。将来対応で追加する。

12.3 生成画像サイズ

許可する値:

* 2048x1152
* 1024x768
* 3840x2160

禁止する値:

* 1920x1080
* 1280x720
* auto

autoはAPI上選べるが、MVPではレビューと書き出しのサイズ管理を安定させるため使わない。

12.4 スライド枚数

最小:

* 5枚

最大:

* 20枚

初期値:

* 10枚

⸻

13. エラーハンドリング

13.1 YouTube解析失敗

表示文言:

YouTube動画を解析できませんでした。公開動画か確認するか、動画ファイルとしてアップロードしてください。

内部ログ:

* URL
* Gemini response error
* job_id
* project_id

13.2 動画ファイル解析失敗

表示文言:

動画ファイルを解析できませんでした。形式やファイルサイズを確認してください。

内部ログ:

* storage_key
* mime_type
* file_size_bytes
* Gemini file upload result
* Gemini response error

13.3 構成JSON不正

表示文言:

スライド構成の作成に失敗しました。もう一度お試しください。

対応:

* Geminiへ最大1回だけ再リクエスト
* 再リクエストでも失敗したらfailed

13.4 画像生成失敗

表示文言:

一部のスライド画像を生成できませんでした。失敗したスライドはレビュー画面から再生成できます。

対応:

* 他スライドの生成は継続
* 失敗スライドのみfailed
* レビュー画面で再生成ボタンを表示

13.5 ZIP書き出し失敗

表示文言:

ダウンロードファイルの作成に失敗しました。もう一度書き出してください。

対応:

* export_zip jobを再実行可能にする

⸻

14. セキュリティ設計

14.1 APIキー管理

* Gemini APIキーはサーバー側の環境変数で管理
* OpenAI APIキーはサーバー側の環境変数で管理
* フロントエンドへAPIキーを渡さない

環境変数:

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-2

GEMINI_MODELは環境変数で差し替え可能にする。理由は、Gemini側のモデル名や安定版の選定が変わる可能性があるため。

14.2 アップロード保護

* 署名付きURLでアップロード
* MIME typeと拡張子をサーバー側で検証
* ファイルサイズ上限をサーバー側で検証
* アップロード完了後にHEADリクエストで実サイズ確認
* 不正ファイルは削除

14.3 ダウンロード保護

* ZIPダウンロードは署名付きURL
* 署名付きURLの有効期限は5分
* project_idの所有確認を行う

14.4 データ保持

MVPの推奨保持期間:

* アップロード動画：24時間
* Gemini File API側の保存：仕様上48時間
* 生成画像：7日
* ZIP：7日
* job_events：30日

14.5 著作権・利用規約

UIまたは利用規約に以下の注意を入れる。

生成した資料の利用範囲は、元動画の権利者、YouTubeの利用規約、社内外の配布範囲に従ってください。

⸻

15. 監視・ログ設計

15.1 記録するログ

* project_id
* job_id
* user_id
* source_type
* selected_image_size
* slide_count
* provider
* provider_model
* provider_request_id
* latency_ms
* retry_count
* error_code
* error_message

15.2 記録しないもの

* APIキー
* 署名付きURL全文
* ユーザーが入力した動画URLの不要な外部共有
* 生成画像のbase64全文
* 個人情報を含む可能性があるプロンプト全文

プロンプト全文は必要な場合のみ暗号化保存する。MVPではprompt_hashを保存し、デバッグ時は管理者のみ閲覧できる設計にする。

15.3 メトリクス

* 構成生成成功率
* 画像生成成功率
* 平均構成生成時間
* 平均画像生成時間
* 1プロジェクトあたり平均生成枚数
* 再生成率
* ZIP書き出し成功率
* キャンセル率

⸻

16. コスト制御

16.1 生成枚数制限

MVPでは最大20枚。

初期値は10枚。

16.2 品質制限

MVPの標準品質はmedium。

highは将来、有料プランまたは明示的な追加設定にする。

16.3 高解像度制限

3840x2160はMVPでも選択肢に出せるが、注意文を入れる。

表示文言:

高解像度は生成に時間がかかる場合があります。

運用上、コストが高ければ初期版では非表示にしてもよい。

16.4 再生成制限

MVPでは1プロジェクトあたり再生成回数を制限する。

推奨:

* 無料またはテスト環境：10回
* 管理者環境：無制限

⸻

17. 実装マイルストーン

Phase 0：API仕様確認と疎通

作業:

* Gemini APIキー設定
* OpenAI APIキー設定
* GeminiでYouTube URL解析の疎通
* Geminiで動画ファイル解析の疎通
* Gemini構造化出力の疎通
* gpt-image-2で2048x1152生成の疎通
* gpt-image-2で1024x768生成の疎通
* gpt-image-2で3840x2160生成の疎通

完了条件:

* 3サイズすべての生成可否が実APIで確認済み
* 1920x1080を使わない方針が実装に反映済み

Phase 1：基本UIとプロジェクト作成

作業:

* 入力画面
* 設定画面
* プロジェクト作成API
* YouTube URL登録API
* 動画アップロードAPI
* 設定保存API

完了条件:

* YouTube URLまたは動画ファイルでプロジェクト作成できる
* 設定値がDBに保存される

Phase 2：Gemini構成生成

作業:

* structure_generation job
* Gemini解析Worker
* JSON Schema検証
* slides保存
* 構成確認画面

完了条件:

* YouTube URLから構成案が作れる
* 動画ファイルから構成案が作れる
* 構成確認画面でスライド一覧を表示できる

Phase 3：構成編集

作業:

* スライド編集
* スライド追加
* スライド削除
* スライド並べ替え
* タイムスタンプ編集
* 図解タイプ変更

完了条件:

* UI上で構成を編集できる
* 編集内容がDBに保存される
* 画像生成時に編集後の内容が使われる

Phase 4：画像生成

作業:

* image_generation job
* OpenAI Image API連携
* 画像保存
* slide_assets保存
* 生成中画面
* キャンセルAPI

完了条件:

* 10枚のスライド画像を生成できる
* 進捗が表示される
* キャンセルできる
* 失敗スライドを識別できる

Phase 5：レビュー・再生成

作業:

* レビュー画面
* サムネイル表示
* 一覧表示
* 選択中を再生成
* 指示を調整して再生成
* 構成を編集導線

完了条件:

* 生成画像を確認できる
* スライド単位で再生成できる
* 追加指示つきで再生成できる

Phase 6：書き出し

作業:

* export_zip job
* ZIP生成
* 署名付きURL発行
* 書き出し完了画面
* レビューへ戻る
* 別の動画で作る

完了条件:

* 生成画像をZIPで一括ダウンロードできる
* ZIP内のファイル名がスライド順になっている

Phase 7：QA・運用準備

作業:

* エラー文言整備
* ログ整備
* コスト監視
* データ削除バッチ
* E2Eテスト
* 利用規約・注意文追加

完了条件:

* 主要な失敗パターンをUIで処理できる
* 不要データが自動削除される
* MVP公開可能な状態になる

⸻

18. テスト計画

18.1 単体テスト

対象:

* YouTube URLバリデーション
* 動画ファイルバリデーション
* 生成画像サイズバリデーション
* Gemini JSON Schema検証
* タイムスタンプ変換
* スライド並べ替え
* ZIPファイル名生成

18.2 結合テスト

対象:

* YouTube URL → 構成生成
* 動画ファイル → 構成生成
* 構成編集 → 画像生成
* 画像生成 → レビュー
* レビュー → 再生成
* レビュー → ZIP書き出し

18.3 E2Eテスト

主要シナリオ:

1. YouTube URLを入力
2. 設定を選択
3. 構成案を生成
4. 構成を編集
5. 画像を生成
6. 1枚を再生成
7. ZIPで書き出し

18.4 API契約テスト

必須:

* gpt-image-2で2048x1152が通る
* gpt-image-2で1024x768が通る
* gpt-image-2で3840x2160が通る
* 1920x1080を送らない
* Gemini構造化出力がSchemaに合う

⸻

19. 受け入れ基準

19.1 入力

* YouTube URLで開始できる
* 動画ファイルで開始できる
* YouTube URLタブにアップロード欄が表示されない
* 動画ファイルタブにURL入力欄が表示されない
* 限定公開・非公開動画への注意文が表示される

19.2 設定

* 「生成画像サイズ」と表示される
* 1920x1080が表示されない
* 2048x1152が初期選択される
* 1024x768を選択できる
* 3840x2160を選択できる

19.3 構成確認

* 図解タイプが4種類に限定される
* 「説明ポイント」ではなく「誤解ポイント」が表示される
* スライドを追加できる
* スライドを削除できる
* スライドを並べ替えできる

19.4 画像生成

* 画像生成中に現在のスライド番号が表示される
* 生成をキャンセルできる
* 失敗したスライドだけ再生成できる
* 全スライドの生成後にレビューへ進める

19.5 レビュー

* サムネイルで全スライドを確認できる
* 選択中のスライドを再生成できる
* 指示を調整して再生成できる
* 構成編集へ戻れる
* 書き出しへ進める

19.6 書き出し

* ZIPで画像を一括ダウンロードできる
* ZIP内のファイル名がslide_01.png形式になっている
* 書き出し画面からレビューへ戻れる
* 「最初からやり直す」ではなく「別の動画で作る」と表示される

⸻

20. リスクと対策

20.1 画像内テキストが崩れる

リスク:

* gpt-image-2でも細かい文字や厳密な配置は崩れる可能性がある。

対策:

* プロンプトで長文を避ける
* 1スライド1メッセージにする
* レビューで再生成しやすくする
* 将来、テキスト後載せへ移行する

20.2 複数スライドのデザイン一貫性が揺れる

リスク:

* 各スライドを個別生成するため、色や図解スタイルが揺れる。

対策:

* 全スライド共通のstyle promptを使う
* テーマ別の固定プロンプトを用意する
* 将来、ブランドテンプレート・参照画像・後載せ化で改善する

20.3 Geminiが動画にない内容を補う

リスク:

* 動画内容から推測して、未確認情報を混ぜる可能性がある。

対策:

* verification_noteを必須にする
* タイムスタンプを必須にする
* 「未確認」と明記させる
* 構成確認画面でユーザーが確認できるようにする

20.4 YouTube URLが解析できない

リスク:

* 限定公開、非公開、地域制限、年齢制限などで解析できない。

対策:

* 入力画面に公開YouTube URLのみ対応と明記
* 失敗時は動画ファイルアップロードを案内
* エラー文言を具体的にする

20.5 長い動画で処理が重い

リスク:

* Gemini解析と画像生成の待ち時間が長くなる。

対策:

* ジョブ化する
* 進捗を表示する
* キャンセル可能にする
* 将来、長尺動画では区間指定やチャプター指定を追加する

⸻

21. 将来拡張方針

21.1 テキスト後載せ

将来は、画像生成を背景・図解素材に限定し、タイトルや本文はHTML/SVG/PPTX側で後載せする。

メリット:

* 文字が崩れない
* 修正しやすい
* PowerPoint出力しやすい
* ブランド反映しやすい

21.2 PowerPoint出力

対応方針:

* 各スライド画像を背景画像として配置
* 将来の後載せテキスト対応後は、PPTXのテキストボックスとして配置

21.3 PDF出力

対応方針:

* 生成画像をページ単位でPDF化
* 将来は注釈やメモ欄を追加

21.4 Figma連携

対応方針:

* 生成画像をFigmaノードとして配置
* 後載せテキスト化後に編集可能レイヤーとして展開

21.5 HTML資料化

対応方針:

* 画像スライドをWebプレゼン形式で表示
* タイムスタンプリンクを追加
* 動画とスライドの同期表示も将来検討

⸻

22. 最終方針

MVPの実装方針は以下で確定する。

* 入力はYouTube URLと動画ファイルの2入口
* YouTube URLは公開動画のみ
* 動画ファイルはMP4 / MOV / AVI、最大2GB
* Geminiで動画解析と構成生成
* JSON Schemaで構成を固定
* スライド種別はタイムライン、概念図、比較図、誤解ポイント
* クイズは作らない
* 画像生成はOpenAI Image APIのgpt-image-2
* 1スライド1枚の完成画像として生成
* サイズはgpt-image-2仕様に合わせる
* 1920x1080は使わない
* 標準サイズは2048x1152
* 4:3は1024x768
* 高解像度は3840x2160
* 生成後はレビューで再生成・指示調整できる
* 書き出しはZIP形式のみ
* PowerPoint、PDF、Figma、HTMLは将来対応
