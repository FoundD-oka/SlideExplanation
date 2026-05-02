import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type {
  DatabaseShape,
  ExportRecord,
  Job,
  JobEvent,
  JobType,
  Project,
  ProjectSettings,
  Slide,
  SlideAsset,
  SlideStatus,
  SlideWithAsset,
  SourceType,
  VideoSource
} from "./types";

const storageDir = process.env.APP_STORAGE_DIR || ".data";
const STORAGE_ROOT = path.isAbsolute(storageDir)
  ? storageDir
  : path.join(/*turbopackIgnore: true*/ process.cwd(), storageDir);
const ASSET_DIR = path.join(STORAGE_ROOT, "assets");
const EXPORT_DIR = path.join(STORAGE_ROOT, "exports");
const DB_PATH = path.join(STORAGE_ROOT, "store.json");

const emptyDatabase: DatabaseShape = {
  projects: [],
  videoSources: [],
  settings: [],
  slides: [],
  slideAssets: [],
  jobs: [],
  jobEvents: [],
  exports: []
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return randomUUID();
}

export function promptHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function readDb(): DatabaseShape {
  ensureStorage();
  if (!fs.existsSync(DB_PATH)) {
    writeDb(emptyDatabase);
    return structuredClone(emptyDatabase);
  }

  const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Partial<DatabaseShape>;
  return {
    projects: parsed.projects ?? [],
    videoSources: parsed.videoSources ?? [],
    settings: parsed.settings ?? [],
    slides: parsed.slides ?? [],
    slideAssets: parsed.slideAssets ?? [],
    jobs: parsed.jobs ?? [],
    jobEvents: parsed.jobEvents ?? [],
    exports: parsed.exports ?? []
  };
}

export function writeDb(db: DatabaseShape): void {
  ensureStorage();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function ensureStorage(): void {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

export function createProject(sourceType: SourceType): Project {
  const db = readDb();
  const timestamp = nowIso();
  const project: Project = {
    id: newId(),
    userId: null,
    title: null,
    sourceType,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  db.projects.push(project);
  writeDb(db);
  return project;
}

export function getProject(projectId: string): Project | null {
  return readDb().projects.find((project) => project.id === projectId) ?? null;
}

export function updateProject(projectId: string, patch: Partial<Pick<Project, "title" | "status">>): Project {
  const db = readDb();
  const project = requireProject(db, projectId);
  Object.assign(project, patch, { updatedAt: nowIso() });
  writeDb(db);
  return project;
}

export function createVideoSource(input: Omit<VideoSource, "id" | "createdAt">): VideoSource {
  const db = readDb();
  requireProject(db, input.projectId);
  db.videoSources = db.videoSources.filter((source) => source.projectId !== input.projectId);
  const source: VideoSource = {
    id: newId(),
    createdAt: nowIso(),
    ...input
  };
  db.videoSources.push(source);
  const project = requireProject(db, input.projectId);
  project.status = "source_ready";
  project.sourceType = input.sourceType;
  project.updatedAt = nowIso();
  writeDb(db);
  return source;
}

export function getVideoSource(projectId: string): VideoSource | null {
  return readDb().videoSources.find((source) => source.projectId === projectId) ?? null;
}

export function upsertSettings(
  projectId: string,
  settings: Omit<ProjectSettings, "id" | "projectId" | "createdAt" | "updatedAt">
): ProjectSettings {
  const db = readDb();
  requireProject(db, projectId);
  const existing = db.settings.find((row) => row.projectId === projectId);
  const timestamp = nowIso();

  if (existing) {
    Object.assign(existing, settings, { updatedAt: timestamp });
    writeDb(db);
    return existing;
  }

  const row: ProjectSettings = {
    id: newId(),
    projectId,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...settings
  };
  db.settings.push(row);
  writeDb(db);
  return row;
}

export function getSettings(projectId: string): ProjectSettings | null {
  return readDb().settings.find((settings) => settings.projectId === projectId) ?? null;
}

export function replaceSlides(projectId: string, slides: Slide[]): Slide[] {
  const db = readDb();
  requireProject(db, projectId);
  const existingSlideIds = new Set(db.slides.filter((slide) => slide.projectId === projectId).map((slide) => slide.id));
  db.slides = db.slides.filter((slide) => slide.projectId !== projectId);
  db.slideAssets = db.slideAssets.filter((asset) => !existingSlideIds.has(asset.slideId));
  db.slides.push(...slides);
  writeDb(db);
  return listSlides(projectId);
}

export function listSlides(projectId: string): SlideWithAsset[] {
  const db = readDb();
  return db.slides
    .filter((slide) => slide.projectId === projectId)
    .sort((a, b) => a.slideNumber - b.slideNumber)
    .map((slide) => ({
      ...slide,
      latestAsset: latestAssetForSlide(db.slideAssets, slide.id)
    }));
}

export function getSlide(slideId: string): Slide | null {
  return readDb().slides.find((slide) => slide.id === slideId) ?? null;
}

export function updateSlide(slideId: string, patch: Partial<Slide>): Slide {
  const db = readDb();
  const slide = requireSlide(db, slideId);
  Object.assign(slide, patch, { updatedAt: nowIso() });
  writeDb(db);
  return slide;
}

export function updateSlideStatus(slideId: string, status: SlideStatus): Slide {
  return updateSlide(slideId, { status });
}

export function addSlide(
  projectId: string,
  input: Pick<Slide, "title" | "description" | "diagramType"> & { insertAfterSlideNumber?: number }
): SlideWithAsset[] {
  const db = readDb();
  requireProject(db, projectId);
  const timestamp = nowIso();
  const projectSlides = db.slides
    .filter((slide) => slide.projectId === projectId)
    .sort((a, b) => a.slideNumber - b.slideNumber);
  const insertAfter = input.insertAfterSlideNumber ?? projectSlides.length;
  const slide: Slide = {
    id: newId(),
    projectId,
    slideNumber: insertAfter + 1,
    title: input.title,
    description: input.description,
    diagramType: input.diagramType,
    sourceStartSeconds: null,
    sourceEndSeconds: null,
    learningGoal: input.description,
    mainPoints: [input.description],
    visualConcept: "追加された補足スライド",
    imagePrompt: "",
    speakerNotes: null,
    misunderstandingRisk: null,
    verificationNote: "ユーザー追加",
    status: "ready_for_generation",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.slides.push(slide);
  renumberSlides(db, projectId, slide.id, insertAfter + 1);
  writeDb(db);
  return listSlides(projectId);
}

export function deleteSlide(slideId: string): SlideWithAsset[] {
  const db = readDb();
  const slide = requireSlide(db, slideId);
  db.slides = db.slides.filter((row) => row.id !== slideId);
  db.slideAssets = db.slideAssets.filter((asset) => asset.slideId !== slideId);
  renumberSlides(db, slide.projectId);
  writeDb(db);
  return listSlides(slide.projectId);
}

export function reorderSlides(projectId: string, slideIds: string[]): SlideWithAsset[] {
  const db = readDb();
  const projectSlides = db.slides.filter((slide) => slide.projectId === projectId);
  const projectSlideIds = new Set(projectSlides.map((slide) => slide.id));
  if (slideIds.length !== projectSlides.length || slideIds.some((id) => !projectSlideIds.has(id))) {
    throw new Error("並べ替え対象のスライドが一致しません");
  }

  slideIds.forEach((id, index) => {
    const slide = requireSlide(db, id);
    slide.slideNumber = index + 1;
    slide.updatedAt = nowIso();
  });
  writeDb(db);
  return listSlides(projectId);
}

export function createJob(projectId: string, jobType: JobType, totalSlides: number | null = null): Job {
  const db = readDb();
  requireProject(db, projectId);
  const timestamp = nowIso();
  const job: Job = {
    id: newId(),
    projectId,
    jobType,
    status: "queued",
    currentStep: null,
    progressPercent: 0,
    currentSlideNumber: null,
    totalSlides,
    progressMessage: null,
    errorMessage: null,
    cancelledAt: null,
    startedAt: null,
    completedAt: null,
    exportId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  db.jobs.push(job);
  writeDb(db);
  return job;
}

export function getJob(jobId: string): Job | null {
  return readDb().jobs.find((job) => job.id === jobId) ?? null;
}

export function updateJob(jobId: string, patch: Partial<Job>): Job {
  const db = readDb();
  const job = requireJob(db, jobId);
  Object.assign(job, patch, { updatedAt: nowIso() });
  writeDb(db);
  return job;
}

export function cancelJob(jobId: string): Job {
  return updateJob(jobId, {
    status: "cancelled",
    cancelledAt: nowIso(),
    progressMessage: "生成をキャンセルしました"
  });
}

export function addJobEvent(jobId: string, eventType: string, message: string, metadata: Record<string, unknown> | null = null): void {
  const db = readDb();
  requireJob(db, jobId);
  const event: JobEvent = {
    id: newId(),
    jobId,
    eventType,
    message,
    metadata,
    createdAt: nowIso()
  };
  db.jobEvents.push(event);
  writeDb(db);
}

export function getAssetsForProject(projectId: string): SlideAsset[] {
  const db = readDb();
  return db.slideAssets
    .filter((asset) => asset.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getAsset(assetId: string): SlideAsset | null {
  return readDb().slideAssets.find((asset) => asset.id === assetId) ?? null;
}

export function addSlideAsset(input: Omit<SlideAsset, "id" | "createdAt">): SlideAsset {
  const db = readDb();
  requireSlide(db, input.slideId);
  const asset: SlideAsset = {
    id: newId(),
    createdAt: nowIso(),
    ...input
  };
  db.slideAssets.push(asset);
  writeDb(db);
  return asset;
}

export function latestAssetVersion(slideId: string): number {
  const assets = readDb().slideAssets.filter((asset) => asset.slideId === slideId);
  return assets.length === 0 ? 0 : Math.max(...assets.map((asset) => asset.version));
}

export function writeAssetBuffer(projectId: string, fileName: string, buffer: Buffer): string {
  ensureStorage();
  const projectDir = path.join(ASSET_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const storageKey = path.join("assets", projectId, fileName);
  fs.writeFileSync(path.join(STORAGE_ROOT, storageKey), buffer);
  return storageKey;
}

export function readStoredBuffer(storageKey: string): Buffer {
  const fullPath = path.join(STORAGE_ROOT, storageKey);
  return fs.readFileSync(fullPath);
}

export function createExport(input: Omit<ExportRecord, "id" | "createdAt">): ExportRecord {
  const db = readDb();
  const record: ExportRecord = {
    id: newId(),
    createdAt: nowIso(),
    ...input
  };
  db.exports.push(record);
  writeDb(db);
  return record;
}

export function getExport(exportId: string): ExportRecord | null {
  return readDb().exports.find((record) => record.id === exportId) ?? null;
}

export function writeExportBuffer(projectId: string, fileName: string, buffer: Buffer): { storageKey: string; fileSizeBytes: number } {
  ensureStorage();
  const projectDir = path.join(EXPORT_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const storageKey = path.join("exports", projectId, fileName);
  fs.writeFileSync(path.join(STORAGE_ROOT, storageKey), buffer);
  return { storageKey, fileSizeBytes: buffer.byteLength };
}

function latestAssetForSlide(assets: SlideAsset[], slideId: string): SlideAsset | null {
  const slideAssets = assets.filter((asset) => asset.slideId === slideId);
  if (slideAssets.length === 0) {
    return null;
  }
  return slideAssets.sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];
}

function renumberSlides(db: DatabaseShape, projectId: string, movedSlideId?: string, preferredNumber?: number): void {
  const timestamp = nowIso();
  const slides = db.slides
    .filter((slide) => slide.projectId === projectId)
    .sort((a, b) => {
      if (movedSlideId && preferredNumber) {
        if (a.id === movedSlideId) return preferredNumber - b.slideNumber - 0.5;
        if (b.id === movedSlideId) return a.slideNumber - preferredNumber + 0.5;
      }
      return a.slideNumber - b.slideNumber;
    });

  slides.forEach((slide, index) => {
    slide.slideNumber = index + 1;
    slide.updatedAt = timestamp;
  });
}

function requireProject(db: DatabaseShape, projectId: string): Project {
  const project = db.projects.find((row) => row.id === projectId);
  if (!project) {
    throw new Error("プロジェクトが見つかりません");
  }
  return project;
}

function requireSlide(db: DatabaseShape, slideId: string): Slide {
  const slide = db.slides.find((row) => row.id === slideId);
  if (!slide) {
    throw new Error("スライドが見つかりません");
  }
  return slide;
}

function requireJob(db: DatabaseShape, jobId: string): Job {
  const job = db.jobs.find((row) => row.id === jobId);
  if (!job) {
    throw new Error("ジョブが見つかりません");
  }
  return job;
}
