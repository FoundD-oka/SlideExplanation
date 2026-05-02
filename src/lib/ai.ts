import { PNG } from "pngjs";
import { DIAGRAM_LABELS, parseImageSize } from "./constants";
import { SLIDE_THEME_BASE_PROMPT, SLIDE_THEME_KEYWORDS, SLIDE_THEME_NAME, SLIDE_THEME_PROMPTS } from "./slide-theme";
import {
  getSettings,
  getVideoSource,
  newId,
  nowIso,
  promptHash,
  readStoredBuffer,
  writeAssetBuffer
} from "./store";
import type {
  DiagramType,
  ProjectSettings,
  Slide,
  SlideAsset,
  VideoSource
} from "./types";

const GEMINI_SCHEMA = {
  type: "object",
  required: ["video_title", "target_audience", "core_message", "slides"],
  properties: {
    video_title: { type: "string" },
    target_audience: { type: "string" },
    core_message: { type: "string" },
    slides: {
      type: "array",
      minItems: 5,
      maxItems: 20,
      items: {
        type: "object",
        required: [
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
        properties: {
          slide_number: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          diagram_type: {
            type: "string",
            enum: ["timeline", "concept_map", "comparison", "misunderstanding"]
          },
          learning_goal: { type: "string" },
          source_timestamps: { type: "array", items: { type: "string" } },
          main_points: { type: "array", items: { type: "string" } },
          visual_concept: { type: "string" },
          image_prompt_for_gpt_image_2: { type: "string" },
          speaker_notes: { type: "string" },
          misunderstanding_risk: { type: "string" },
          verification_note: { type: "string" }
        }
      }
    }
  }
};

interface GeminiSlide {
  slide_number: number;
  title: string;
  description: string;
  diagram_type: DiagramType;
  learning_goal: string;
  source_timestamps: string[];
  main_points: string[];
  visual_concept: string;
  image_prompt_for_gpt_image_2: string;
  speaker_notes: string;
  misunderstanding_risk: string;
  verification_note: string;
}

interface GeminiResponseShape {
  video_title: string;
  target_audience: string;
  core_message: string;
  slides: GeminiSlide[];
}

export async function generateStructure(projectId: string): Promise<{ title: string; slides: Slide[] }> {
  const settings = requireSettings(projectId);
  const source = getVideoSource(projectId);
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (geminiKey && source?.sourceType === "youtube_url" && source.youtubeUrl) {
    try {
      return await generateStructureWithGemini(settings, source, geminiKey);
    } catch (error) {
      console.error("Gemini structure generation failed", error);
      throw error;
    }
  }

  return generateMockStructure(projectId, settings, source);
}

export async function generateSlideImage(
  slide: Slide,
  settings: ProjectSettings,
  version: number
): Promise<Omit<SlideAsset, "id" | "createdAt">> {
  const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const { width, height } = parseImageSize(settings.imageSize);
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (openAiKey) {
    const generated = await generateImageWithOpenAI(slide, settings, openAiKey, imageModel);
    const fileName = `slide_${slide.slideNumber.toString().padStart(2, "0")}_v${version}.png`;
    const storageKey = writeAssetBuffer(slide.projectId, fileName, generated.buffer);
    return {
      slideId: slide.id,
      projectId: slide.projectId,
      version,
      storageKey,
      width,
      height,
      format: "png",
      provider: "openai",
      providerModel: imageModel,
      providerRequestId: generated.requestId,
      promptHash: promptHash(slide.imagePrompt)
    };
  }

  const buffer = renderMockSlidePng({
    width,
    height,
    slideNumber: slide.slideNumber,
    diagramType: slide.diagramType
  });
  const fileName = `slide_${slide.slideNumber.toString().padStart(2, "0")}_v${version}.png`;
  const storageKey = writeAssetBuffer(slide.projectId, fileName, buffer);

  return {
    slideId: slide.id,
    projectId: slide.projectId,
    version,
    storageKey,
    width,
    height,
    format: "png",
    provider: "mock",
    providerModel: "local-mock",
    providerRequestId: null,
    promptHash: promptHash(slide.imagePrompt)
  };
}

export function buildImagePrompt(slide: Pick<Slide, "title" | "learningGoal" | "mainPoints" | "diagramType" | "visualConcept">, settings: ProjectSettings): string {
  const { aspectRatio } = parseImageSize(settings.imageSize);
  return [
    "Create a complete educational slide image.",
    `Theme: ${SLIDE_THEME_BASE_PROMPT}`,
    `Theme keywords: ${SLIDE_THEME_KEYWORDS}`,
    `Canvas: ${settings.imageSize}, aspect ratio ${aspectRatio}.`,
    `Slide purpose: ${slide.learningGoal}`,
    `Slide title: ${slide.title}`,
    `Content to visualize: ${slide.mainPoints.join(" / ")}`,
    `Diagram type: ${DIAGRAM_LABELS[slide.diagramType]}. ${SLIDE_THEME_PROMPTS[slide.diagramType]}`,
    `Visual concept: ${slide.visualConcept}`,
    "Design requirements: white background, clean infographic layout, clear hierarchy, short labels only, bold icons, polished modern layout, no logos, no watermarks, no tiny unreadable labels.",
    `Tone: ${settings.tone}`,
    `Audience: ${settings.audience}`
  ].join("\n");
}

export function assetUrl(asset: SlideAsset | null): string | null {
  return asset ? `/api/assets/${asset.id}` : null;
}

export function readAsset(asset: SlideAsset): Buffer {
  return readStoredBuffer(asset.storageKey);
}

async function generateStructureWithGemini(
  settings: ProjectSettings,
  source: VideoSource,
  apiKey: string
): Promise<{ title: string; slides: Slide[] }> {
  const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = buildGeminiPrompt(settings);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: source.youtubeUrl
              }
            },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${detail}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).filter(Boolean).join("\n");
  if (!text) {
    throw new Error("Gemini APIから構成JSONを取得できませんでした");
  }

  const parsed = JSON.parse(text) as GeminiResponseShape;
  const timestamp = nowIso();
  const slides: Slide[] = parsed.slides.slice(0, settings.slideCount).map((slide, index) => {
    const start = parseTimestamp(slide.source_timestamps[0]) ?? index * 120;
    const end = parseTimestamp(slide.source_timestamps[1]) ?? start + 80;
    const base: Slide = {
      id: newId(),
      projectId: settings.projectId,
      slideNumber: index + 1,
      title: slide.title,
      description: slide.description,
      diagramType: slide.diagram_type,
      sourceStartSeconds: start,
      sourceEndSeconds: end,
      learningGoal: slide.learning_goal,
      mainPoints: slide.main_points,
      visualConcept: slide.visual_concept,
      imagePrompt: applyThemeToImagePrompt(slide.image_prompt_for_gpt_image_2, slide.diagram_type),
      speakerNotes: slide.speaker_notes,
      misunderstandingRisk: slide.misunderstanding_risk,
      verificationNote: slide.verification_note,
      status: "ready_for_generation",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return { ...base, imagePrompt: base.imagePrompt || buildImagePrompt(base, settings) };
  });

  return { title: parsed.video_title || "動画理解サポート資料", slides };
}

function generateMockStructure(
  projectId: string,
  settings: ProjectSettings,
  source: VideoSource | null
): { title: string; slides: Slide[] } {
  const timestamp = nowIso();
  const topic = source?.youtubeUrl ? "YouTube動画" : source?.originalFilename ?? "動画";
  const templates = [
    ["この動画でわかること", "動画全体のゴールと流れを短く整理します。", "timeline"],
    ["全体の仕組みをざっくり理解", "中心になる概念と周辺要素の関係を整理します。", "concept_map"],
    ["重要ポイント1", "最初に押さえるべき判断基準を明確にします。", "concept_map"],
    ["AとBの違いを比較", "似ている概念の違いを並べて理解します。", "comparison"],
    ["つまずきやすいポイント", "誤解しやすい箇所と正しい見方を分けます。", "misunderstanding"],
    ["重要ポイント2", "応用時に効く視点を整理します。", "concept_map"],
    ["具体例で理解を深める", "実例を使って抽象的な話を掴みやすくします。", "timeline"],
    ["全体のつながりを整理", "ここまでの情報を一枚の流れにまとめます。", "concept_map"],
    ["実践時のチェックポイント", "利用時に確認すべき項目を比較して整理します。", "comparison"],
    ["まとめと次の行動", "復習すべき要点と次に試すことを整理します。", "timeline"],
    ["補足: よくある混同", "似た表現や条件の違いを明確にします。", "misunderstanding"],
    ["応用パターン", "別の場面に使うときの考え方を整理します。", "concept_map"],
    ["判断フロー", "どの順番で考えるかを流れで示します。", "timeline"],
    ["メリットと注意点", "得られる価値と気をつける点を比較します。", "comparison"],
    ["最終確認", "重要ポイントを再確認し、理解の抜けを減らします。", "misunderstanding"],
    ["背景知識", "前提となる概念を簡潔に整理します。", "concept_map"],
    ["手順の全体像", "実行手順を時系列で把握します。", "timeline"],
    ["選択肢の整理", "複数の選択肢を比較して判断しやすくします。", "comparison"],
    ["誤解の修正", "よくある理解違いを修正します。", "misunderstanding"],
    ["共有用まとめ", "他者に説明するときの核をまとめます。", "timeline"]
  ] satisfies Array<[string, string, DiagramType]>;

  const slides = Array.from({ length: settings.slideCount }, (_, index) => {
    const [title, description, diagramType] = templates[index] ?? templates[index % templates.length];
    const start = index * 80 + (index > 0 ? index : 0);
    const base: Slide = {
      id: newId(),
      projectId,
      slideNumber: index + 1,
      title,
      description,
      diagramType,
      sourceStartSeconds: start,
      sourceEndSeconds: start + 80,
      learningGoal: `${topic}の内容を、${title}として理解できるようにする`,
      mainPoints: [
        "動画内で説明された要点を短く整理",
        "関係性や順序が見える図解にする",
        "誤解しやすい箇所を分離して示す"
      ],
      visualConcept: `${DIAGRAM_LABELS[diagramType]}として、短いラベルと図形で理解を補助する`,
      imagePrompt: "",
      speakerNotes: "実APIキー未設定時はローカルのモック構成を表示します。",
      misunderstandingRisk: diagramType === "misunderstanding" ? "似た概念を同じものとして理解してしまう可能性" : null,
      verificationNote: "未確認",
      status: "ready_for_generation",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return { ...base, imagePrompt: buildImagePrompt(base, settings) };
  });

  return { title: "動画理解サポート資料", slides };
}

async function generateImageWithOpenAI(
  slide: Slide,
  settings: ProjectSettings,
  apiKey: string,
  imageModel: string
): Promise<{ buffer: Buffer; requestId: string | null }> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: slide.imagePrompt,
      size: settings.imageSize,
      quality: settings.imageQuality,
      output_format: settings.outputFormat,
      n: 1
    })
  });

  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI Image API error ${response.status}: ${detail}`);
  }

  const json = await response.json();
  const first = json?.data?.[0];
  if (first?.b64_json) {
    return { buffer: Buffer.from(first.b64_json, "base64"), requestId };
  }
  if (first?.url) {
    const imageResponse = await fetch(first.url);
    if (!imageResponse.ok) {
      throw new Error("OpenAI生成画像の取得に失敗しました");
    }
    return { buffer: Buffer.from(await imageResponse.arrayBuffer()), requestId };
  }

  throw new Error("OpenAI Image APIから画像データを取得できませんでした");
}

function buildGeminiPrompt(settings: ProjectSettings): string {
  return `あなたはYouTube動画・動画教材を、理解サポート用スライドに変換する編集者です。
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
- スライド枚数: ${settings.slideCount}
- 対象読者: ${settings.audience}
- 資料のトーン: ${settings.tone}
- 生成画像サイズ: ${settings.imageSize}
スライド画像テーマ: ${SLIDE_THEME_NAME}
- ${SLIDE_THEME_BASE_PROMPT}
- 図解タイプ別の表現:
  - タイムライン: ${SLIDE_THEME_PROMPTS.timeline}
  - 概念図: ${SLIDE_THEME_PROMPTS.concept_map}
  - 比較図: ${SLIDE_THEME_PROMPTS.comparison}
  - 誤解ポイント: ${SLIDE_THEME_PROMPTS.misunderstanding}
- image_prompt_for_gpt_image_2 には以下のキーワードを自然に含める: ${SLIDE_THEME_KEYWORDS}
出力:
JSONのみ。`;
}

function applyThemeToImagePrompt(imagePrompt: string, diagramType: DiagramType): string {
  return [
    `Theme: ${SLIDE_THEME_NAME}`,
    SLIDE_THEME_BASE_PROMPT,
    `Diagram-specific theme: ${SLIDE_THEME_PROMPTS[diagramType]}`,
    `Keywords to reflect: ${SLIDE_THEME_KEYWORDS}`,
    imagePrompt
  ].filter(Boolean).join("\n");
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const parts = normalized.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function requireSettings(projectId: string): ProjectSettings {
  const settings = getSettings(projectId);
  if (!settings) {
    throw new Error("設定が保存されていません");
  }
  return settings;
}

function renderMockSlidePng(input: {
  width: number;
  height: number;
  slideNumber: number;
  diagramType: DiagramType;
}): Buffer {
  const png = new PNG({ width: input.width, height: input.height });
  const palettes = [
    { bg: [255, 255, 255], primary: [37, 99, 235], accent: [16, 185, 129], warm: [245, 158, 11], ink: [17, 24, 39] },
    { bg: [255, 255, 255], primary: [79, 70, 229], accent: [20, 184, 166], warm: [244, 63, 94], ink: [17, 24, 39] },
    { bg: [255, 255, 255], primary: [2, 132, 199], accent: [34, 197, 94], warm: [249, 115, 22], ink: [17, 24, 39] }
  ];
  const palette = palettes[input.slideNumber % palettes.length];

  fillBackground(png, palette.bg);
  drawRect(png, pct(input.width, 0.06), pct(input.height, 0.08), pct(input.width, 0.42), pct(input.height, 0.022), [...palette.ink, 255]);
  drawRect(png, pct(input.width, 0.06), pct(input.height, 0.125), pct(input.width, 0.24), pct(input.height, 0.012), [148, 163, 184, 255]);
  drawRoundedRect(png, pct(input.width, 0.82), pct(input.height, 0.075), pct(input.width, 0.1), pct(input.height, 0.05), 10, [...palette.primary, 255]);
  drawMinimalIcon(png, pct(input.width, 0.86), pct(input.height, 0.1), pct(input.width, 0.018), [255, 255, 255, 255]);

  if (input.diagramType === "timeline") {
    drawTimeline(png, palette);
  } else if (input.diagramType === "concept_map") {
    drawConceptMap(png, palette);
  } else if (input.diagramType === "comparison") {
    drawComparison(png, palette);
  } else {
    drawMisunderstanding(png, palette);
  }

  drawRect(png, pct(input.width, 0.08), pct(input.height, 0.86), pct(input.width, 0.62), pct(input.height, 0.012), [203, 213, 225, 255]);
  drawRect(png, pct(input.width, 0.08), pct(input.height, 0.89), pct(input.width, 0.42), pct(input.height, 0.012), [226, 232, 240, 255]);

  return PNG.sync.write(png);
}

function fillBackground(png: PNG, rgb: number[]): void {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, [rgb[0], rgb[1], rgb[2], 255]);
    }
  }
}

function drawTimeline(png: PNG, palette: Palette): void {
  const y = pct(png.height, 0.5);
  drawLine(png, pct(png.width, 0.14), y, pct(png.width, 0.84), y, [...palette.primary, 255], 8);
  drawArrowHead(png, pct(png.width, 0.84), y, [...palette.primary, 255]);
  [0.18, 0.38, 0.58, 0.78].forEach((xRatio, index) => {
    const x = pct(png.width, xRatio);
    drawCircle(png, x, y, pct(png.width, 0.032), [255, 255, 255, 255]);
    drawCircle(png, x, y, pct(png.width, 0.022), index % 2 ? [...palette.accent, 255] : [...palette.primary, 255]);
    drawRoundedRect(png, x - pct(png.width, 0.075), y + pct(png.height, 0.075), pct(png.width, 0.15), pct(png.height, 0.105), 10, [248, 250, 252, 255]);
    drawRect(png, x - pct(png.width, 0.052), y + pct(png.height, 0.105), pct(png.width, 0.104), 9, [...palette.ink, 255]);
    drawRect(png, x - pct(png.width, 0.044), y + pct(png.height, 0.135), pct(png.width, 0.088), 7, [148, 163, 184, 255]);
  });
}

function drawConceptMap(png: PNG, palette: Palette): void {
  const cx = pct(png.width, 0.5);
  const cy = pct(png.height, 0.5);
  const nodes = [
    [0.23, 0.36, palette.accent],
    [0.77, 0.36, palette.warm],
    [0.25, 0.68, palette.primary],
    [0.76, 0.68, palette.accent]
  ] as const;
  nodes.forEach(([xRatio, yRatio, color]) => {
    drawLine(png, cx, cy, pct(png.width, xRatio), pct(png.height, yRatio), [171, 184, 204, 255], 8);
    drawCircle(png, pct(png.width, xRatio), pct(png.height, yRatio), pct(png.width, 0.068), [...color, 255]);
    drawMinimalIcon(png, pct(png.width, xRatio), pct(png.height, yRatio), pct(png.width, 0.026), [255, 255, 255, 255]);
  });
  drawCircle(png, cx, cy, pct(png.width, 0.11), [...palette.primary, 255]);
  drawCircle(png, cx, cy, pct(png.width, 0.064), [255, 255, 255, 255]);
  drawRect(png, cx - pct(png.width, 0.04), cy - 5, pct(png.width, 0.08), 10, [...palette.ink, 255]);
}

function drawComparison(png: PNG, palette: Palette): void {
  drawRoundedRect(png, pct(png.width, 0.08), pct(png.height, 0.27), pct(png.width, 0.38), pct(png.height, 0.45), 12, [248, 250, 252, 255]);
  drawRoundedRect(png, pct(png.width, 0.54), pct(png.height, 0.27), pct(png.width, 0.38), pct(png.height, 0.45), 12, [248, 250, 252, 255]);
  drawRect(png, pct(png.width, 0.13), pct(png.height, 0.34), pct(png.width, 0.23), pct(png.height, 0.03), [...palette.primary, 255]);
  drawRect(png, pct(png.width, 0.59), pct(png.height, 0.34), pct(png.width, 0.23), pct(png.height, 0.03), [...palette.accent, 255]);
  [0.43, 0.52, 0.61].forEach((ratio) => {
    drawRect(png, pct(png.width, 0.13), pct(png.height, ratio), pct(png.width, 0.23), 10, [148, 163, 184, 255]);
    drawRect(png, pct(png.width, 0.59), pct(png.height, ratio), pct(png.width, 0.23), 10, [148, 163, 184, 255]);
  });
  drawCircle(png, pct(png.width, 0.5), pct(png.height, 0.5), pct(png.width, 0.046), [...palette.warm, 255]);
  drawRect(png, pct(png.width, 0.485), pct(png.height, 0.495), pct(png.width, 0.03), 8, [255, 255, 255, 255]);
}

function drawMisunderstanding(png: PNG, palette: Palette): void {
  drawRoundedRect(png, pct(png.width, 0.08), pct(png.height, 0.3), pct(png.width, 0.84), pct(png.height, 0.17), 12, [248, 250, 252, 255]);
  drawRoundedRect(png, pct(png.width, 0.08), pct(png.height, 0.56), pct(png.width, 0.84), pct(png.height, 0.17), 12, [248, 250, 252, 255]);
  drawCircle(png, pct(png.width, 0.19), pct(png.height, 0.385), pct(png.width, 0.04), [...palette.warm, 255]);
  drawCircle(png, pct(png.width, 0.19), pct(png.height, 0.645), pct(png.width, 0.04), [...palette.accent, 255]);
  drawRect(png, pct(png.width, 0.28), pct(png.height, 0.36), pct(png.width, 0.42), 12, [...palette.ink, 255]);
  drawRect(png, pct(png.width, 0.28), pct(png.height, 0.62), pct(png.width, 0.46), 12, [...palette.ink, 255]);
  drawRect(png, pct(png.width, 0.28), pct(png.height, 0.405), pct(png.width, 0.28), 10, [148, 163, 184, 255]);
  drawRect(png, pct(png.width, 0.28), pct(png.height, 0.665), pct(png.width, 0.32), 10, [148, 163, 184, 255]);
}

type Palette = {
  bg: number[];
  primary: number[];
  accent: number[];
  warm: number[];
  ink: number[];
};

function pct(total: number, ratio: number): number {
  return Math.round(total * ratio);
}

function setPixel(png: PNG, x: number, y: number, rgba: number[]): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const idx = (png.width * y + x) << 2;
  png.data[idx] = clamp(rgba[0]);
  png.data[idx + 1] = clamp(rgba[1]);
  png.data[idx + 2] = clamp(rgba[2]);
  png.data[idx + 3] = clamp(rgba[3]);
}

function drawRect(png: PNG, x: number, y: number, width: number, height: number, rgba: number[]): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgba);
    }
  }
}

function drawRoundedRect(png: PNG, x: number, y: number, width: number, height: number, radius: number, rgba: number[]): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const left = xx < x + radius;
      const right = xx >= x + width - radius;
      const top = yy < y + radius;
      const bottom = yy >= y + height - radius;
      if ((left && top && distance(xx, yy, x + radius, y + radius) > radius) ||
          (right && top && distance(xx, yy, x + width - radius, y + radius) > radius) ||
          (left && bottom && distance(xx, yy, x + radius, y + height - radius) > radius) ||
          (right && bottom && distance(xx, yy, x + width - radius, y + height - radius) > radius)) {
        continue;
      }
      setPixel(png, xx, yy, rgba);
    }
  }
}

function drawCircle(png: PNG, cx: number, cy: number, radius: number, rgba: number[]): void {
  const radiusSquared = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= radiusSquared) {
        setPixel(png, x, y, rgba);
      }
    }
  }
}

function drawMinimalIcon(png: PNG, cx: number, cy: number, radius: number, rgba: number[]): void {
  drawCircle(png, cx, cy, radius, rgba);
  drawRect(png, cx - Math.round(radius * 0.35), cy - Math.round(radius * 0.35), Math.round(radius * 0.7), Math.round(radius * 0.7), rgba);
}

function drawArrowHead(png: PNG, x: number, y: number, rgba: number[]): void {
  const size = pct(png.width, 0.018);
  for (let i = 0; i < size; i += 1) {
    drawLine(png, x - i, y - i, x - i, y + i, rgba, 2);
  }
}

function drawLine(png: PNG, x1: number, y1: number, x2: number, y2: number, rgba: number[], thickness: number): void {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    drawCircle(png, x, y, Math.max(1, Math.round(thickness / 2)), rgba);
  }
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}
