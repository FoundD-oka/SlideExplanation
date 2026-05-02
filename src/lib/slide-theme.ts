import type { DiagramType, SlideTheme } from "./types";

export const DEFAULT_SLIDE_THEME: SlideTheme = "minimal_infographic";

export const SLIDE_THEME_VALUES = [
  "minimal_infographic",
  "timeline_process",
  "concept_mindmap",
  "visual_storyboard",
  "comparison_highlight"
] as const satisfies readonly SlideTheme[];

type SlideThemeDefinition = {
  name: string;
  shortDescription: string;
  recommendedFor: string;
  sampleSrc: string;
  prompt: string;
  keywords: string[];
};

const SLIDE_THEMES: Record<SlideTheme, SlideThemeDefinition> = {
  minimal_infographic: {
    name: "シンプル図解",
    shortDescription: "白背景で要点を読みやすく整理。迷ったらこれ。",
    recommendedFor: "解説・How-to・ビジネス",
    sampleSrc: "/theme-samples/simple-diagram.png",
    prompt: [
      "Use a clean minimalist infographic style based on a white background.",
      "Use bold simple icons, large readable sans-serif labels, short text, and generous spacing.",
      "Prefer clear visual hierarchy over decoration.",
      "Use professional accent colors sparingly for emphasis.",
      "Keep the composition easy to understand at a glance."
    ].join(" "),
    keywords: [
      "clean minimalist infographic style",
      "white background",
      "bold icons",
      "large readable sans-serif text"
    ]
  },
  timeline_process: {
    name: "流れ・手順",
    shortDescription: "時系列や作業手順をステップで見せる。",
    recommendedFor: "作り方・歴史・工程説明",
    sampleSrc: "/theme-samples/flow-steps.png",
    prompt: [
      "Use a horizontal or vertical timeline and process-flow layout.",
      "Visualize chronological steps with connected arrows and clear step numbers.",
      "Keep the layout clean, modern, and easy to scan."
    ].join(" "),
    keywords: [
      "horizontal timeline infographic",
      "chronological steps",
      "connected arrows",
      "clean modern style"
    ]
  },
  concept_mindmap: {
    name: "要点マップ",
    shortDescription: "中心テーマから重要ポイントを枝分かれで整理。",
    recommendedFor: "学習・概念解説・自己啓発",
    sampleSrc: "/theme-samples/point-map.png",
    prompt: [
      "Use a mindmap style summary board.",
      "Place the central idea in the middle with radiating branches for key points.",
      "Use icons and short explanations to make the concept memorable."
    ].join(" "),
    keywords: [
      "mindmap style summary",
      "central concept with radiating branches",
      "icons and short explanations"
    ]
  },
  visual_storyboard: {
    name: "コマ割り解説",
    shortDescription: "場面や手順を数コマに分けて復習しやすくする。",
    recommendedFor: "チュートリアル・場面説明",
    sampleSrc: "/theme-samples/storyboard.png",
    prompt: [
      "Use a storyboard layout with four to six panels.",
      "Arrange important scenes or steps sequentially with short captions.",
      "Use a polished educational storyboard style, not a comic style."
    ].join(" "),
    keywords: [
      "storyboard layout 2x3 grid",
      "sequential scenes with captions",
      "cinematic style"
    ]
  },
  comparison_highlight: {
    name: "比較まとめ",
    shortDescription: "違い、Before/After、メリデメを強調する。",
    recommendedFor: "比較・レビュー・問題解決",
    sampleSrc: "/theme-samples/comparison.png",
    prompt: [
      "Use a comparison or highlight-summary layout.",
      "Show before-after, pros-cons, key number comparisons, or quote-like highlights when useful.",
      "Use bold highlight blocks with a professional color scheme."
    ].join(" "),
    keywords: [
      "split layout comparison infographic",
      "before-after or pros-cons",
      "bold highlights",
      "professional color scheme"
    ]
  }
};

export const SLIDE_THEME_OPTIONS: Array<{
  label: string;
  value: SlideTheme;
  shortDescription: string;
  recommendedFor: string;
  sampleSrc: string;
}> = SLIDE_THEME_VALUES.map((value) => ({
  label: SLIDE_THEMES[value].name,
  value,
  shortDescription: SLIDE_THEMES[value].shortDescription,
  recommendedFor: SLIDE_THEMES[value].recommendedFor,
  sampleSrc: SLIDE_THEMES[value].sampleSrc
}));

export const SLIDE_THEME_PROMPTS: Record<DiagramType, string> = {
  timeline:
    "Use a horizontal timeline infographic or process-flow layout with chronological steps, connected arrows, and a clean modern style. If the content is scene-based, a simple 2x3 storyboard grid is acceptable.",
  concept_map:
    "Use a mindmap style summary board with a central concept, radiating branches, bold icons, and short explanations.",
  comparison:
    "Use a split layout comparison infographic with before-after, pros-cons, or bold highlight blocks in a professional color scheme.",
  misunderstanding:
    "Use a clean minimalist infographic that contrasts the common misunderstanding with the corrected understanding. Use bold icons, large readable sans-serif text, and short labels only."
};

export function getSlideTheme(theme: SlideTheme | undefined): SlideThemeDefinition {
  return SLIDE_THEMES[theme ?? DEFAULT_SLIDE_THEME] ?? SLIDE_THEMES[DEFAULT_SLIDE_THEME];
}

export function getSlideThemeKeywords(theme: SlideTheme | undefined): string {
  return getSlideTheme(theme).keywords.join(", ");
}

export function getSlideThemePrompt(theme: SlideTheme | undefined, diagramType: DiagramType): string {
  const definition = getSlideTheme(theme);
  return [
    definition.prompt,
    `Diagram adaptation: ${SLIDE_THEME_PROMPTS[diagramType]}`
  ].join(" ");
}
