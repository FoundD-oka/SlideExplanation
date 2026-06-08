export type SourceType = "youtube_url" | "video_file";

export type ProjectStatus =
  | "draft"
  | "source_ready"
  | "structure_generating"
  | "structure_ready"
  | "image_generating"
  | "review_ready"
  | "export_ready"
  | "failed"
  | "cancelled";

export type Audience = "beginner";
export type SlideTheme =
  | "visual_abstract"
  | "minimal_infographic"
  | "timeline_process"
  | "concept_mindmap"
  | "visual_storyboard"
  | "comparison_highlight";
export type ImageSize = "2048x1152" | "1024x768" | "3840x2160";
export type ImageQuality = "low" | "medium" | "high";
export type OutputFormat = "png";
export type DiagramType = "timeline" | "concept_map" | "comparison" | "misunderstanding";
export type SlideStatus = "draft" | "ready_for_generation" | "generating" | "generated" | "failed";
export type JobType = "structure_generation" | "image_generation" | "slide_regeneration" | "export_zip";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Project {
  id: string;
  userId: string | null;
  title: string | null;
  sourceType: SourceType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSource {
  id: string;
  projectId: string;
  sourceType: SourceType;
  youtubeUrl: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  storageKey: string | null;
  geminiFileUri: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  slideCount: number;
  audience: Audience;
  theme: SlideTheme;
  imageSize: ImageSize;
  imageQuality: ImageQuality;
  outputFormat: OutputFormat;
  createdAt: string;
  updatedAt: string;
}

export interface Slide {
  id: string;
  projectId: string;
  slideNumber: number;
  title: string;
  description: string;
  diagramType: DiagramType;
  sourceStartSeconds: number | null;
  sourceEndSeconds: number | null;
  learningGoal: string;
  mainPoints: string[];
  visualConcept: string;
  imagePrompt: string;
  speakerNotes: string | null;
  misunderstandingRisk: string | null;
  verificationNote: string | null;
  status: SlideStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SlideAsset {
  id: string;
  slideId: string;
  projectId: string;
  version: number;
  storageKey: string;
  width: number;
  height: number;
  format: OutputFormat;
  provider: "openai" | "mock";
  providerModel: string;
  providerRequestId: string | null;
  promptHash: string;
  createdAt: string;
}

export interface SlideWithAsset extends Slide {
  latestAsset: SlideAsset | null;
}

export interface Job {
  id: string;
  projectId: string;
  jobType: JobType;
  status: JobStatus;
  currentStep: string | null;
  progressPercent: number;
  currentSlideNumber: number | null;
  totalSlides: number | null;
  progressMessage: string | null;
  errorMessage: string | null;
  cancelledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  exportId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  id: string;
  jobId: string;
  eventType: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  exportType: "zip_images";
  storageKey: string;
  fileSizeBytes: number | null;
  status: "ready" | "failed";
  createdAt: string;
}

export interface DatabaseShape {
  projects: Project[];
  videoSources: VideoSource[];
  settings: ProjectSettings[];
  slides: Slide[];
  slideAssets: SlideAsset[];
  jobs: Job[];
  jobEvents: JobEvent[];
  exports: ExportRecord[];
}
