import type { Audience, DiagramType, ImageSize, Tone } from "./types";

export const MAX_VIDEO_UPLOAD_BYTES = 2_000_000_000;

export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/avi"] as const;
export const ACCEPTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi"] as const;

export const IMAGE_SIZE_OPTIONS: Array<{
  label: string;
  value: ImageSize;
  badge?: string;
  helper?: string;
}> = [
  { label: "16:9（推奨）", value: "2048x1152", badge: "おすすめ" },
  {
    label: "16:9（高解像度）",
    value: "3840x2160",
    badge: "高解像度",
    helper: "高解像度は生成に時間がかかる場合があります。"
  },
  { label: "4:3", value: "1024x768" }
];

export const AUDIENCE_OPTIONS: Array<{ label: string; value: Audience }> = [
  { label: "初学者", value: "beginner" },
  { label: "大学生・一般", value: "general" },
  { label: "ビジネスパーソン", value: "business" },
  { label: "専門家・上級者", value: "expert" }
];

export const TONE_OPTIONS: Array<{ label: string; value: Tone }> = [
  { label: "わかりやすく・親しみやすい", value: "friendly" },
  { label: "ビジネスライク・信頼感", value: "business" },
  { label: "シンプル・ミニマル", value: "minimal" },
  { label: "明るく・ポジティブ", value: "positive" }
];

export const DIAGRAM_LABELS: Record<DiagramType, string> = {
  timeline: "タイムライン",
  concept_map: "概念図",
  comparison: "比較図",
  misunderstanding: "誤解ポイント"
};

export const DIAGRAM_BADGE_CLASSES: Record<DiagramType, string> = {
  timeline: "bg-indigo-100 text-indigo-700",
  concept_map: "bg-emerald-100 text-emerald-700",
  comparison: "bg-violet-100 text-violet-700",
  misunderstanding: "bg-rose-100 text-rose-700"
};

export const GENERATION_STEPS = [
  "動画を解析中",
  "構成を作成中",
  "画像を生成中",
  "仕上げ処理中"
] as const;

export function parseImageSize(size: ImageSize): { width: number; height: number; aspectRatio: string } {
  const [width, height] = size.split("x").map(Number);
  return {
    width,
    height,
    aspectRatio: width / height > 1.5 ? "16:9" : "4:3"
  };
}

export function formatTimestamp(start: number | null, end: number | null): string {
  if (start === null || end === null) {
    return "未設定";
  }
  return `${formatSeconds(start)} - ${formatSeconds(end)}`;
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
