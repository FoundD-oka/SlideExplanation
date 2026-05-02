import type { DiagramType } from "./types";

export const SLIDE_THEME_NAME = "テーマサンプル: Minimal Infographic / Process Flow / Mindmap / Storyboard / Comparison";

export const SLIDE_THEME_BASE_PROMPT = [
  "Use a clean minimalist infographic style based on a white background.",
  "Use bold simple icons, large readable sans-serif labels, short text, and generous spacing.",
  "Prefer clear visual hierarchy over decoration.",
  "Use professional accent colors sparingly for emphasis.",
  "Keep the composition easy to understand at a glance."
].join(" ");

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

export const SLIDE_THEME_KEYWORDS = [
  "clean minimalist infographic style",
  "white background",
  "bold icons",
  "large readable sans-serif text",
  "horizontal timeline infographic",
  "chronological steps",
  "connected arrows",
  "mindmap style summary",
  "central concept with radiating branches",
  "storyboard layout 2x3 grid",
  "split layout comparison infographic",
  "bold highlights",
  "professional color scheme"
].join(", ");
