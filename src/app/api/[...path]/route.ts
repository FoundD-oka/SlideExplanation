import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { assetUrl } from "@/lib/ai";
import {
  createProjectSchema,
  exportJobSchema,
  regenerateSchema,
  reorderSlidesSchema,
  settingsSchema,
  slideCreateSchema,
  slidePatchSchema,
  uploadCompleteSchema,
  uploadUrlSchema,
  youtubeSourceSchema
} from "@/lib/validation";
import { regenerateSlide, startExportJob, startImageJob, startStructureJob } from "@/lib/jobs";
import {
  addSlide,
  cancelJob,
  createProject,
  createVideoSource,
  deleteSlide,
  getAsset,
  getExport,
  getJob,
  getProject,
  getSettings,
  listSlides,
  newId,
  readStoredBuffer,
  reorderSlides,
  updateSlide,
  upsertSettings
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  return handleRequest("GET", null, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRequest("POST", request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleRequest("PUT", request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRequest("PATCH", request, context);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  return handleRequest("DELETE", null, context);
}

async function handleRequest(method: string, request: NextRequest | null, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const path = params.path ?? [];
    const body = request ? await readJson(request) : null;

    if (method === "POST" && path.length === 1 && path[0] === "projects") {
      const parsed = createProjectSchema.parse(body);
      const project = createProject(parsed.sourceType);
      return json({ projectId: project.id, project });
    }

    if (method === "GET" && path.length === 2 && path[0] === "projects") {
      const project = getProject(path[1]);
      if (!project) return notFound();
      return json({ project, settings: getSettings(path[1]), slides: listSlides(path[1]).map(serializeSlide) });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "source", "youtube"])) {
      const projectId = path[1];
      const parsed = youtubeSourceSchema.parse(body);
      const source = createVideoSource({
        projectId,
        sourceType: "youtube_url",
        youtubeUrl: parsed.youtubeUrl,
        originalFilename: null,
        mimeType: null,
        fileSizeBytes: null,
        storageKey: null,
        geminiFileUri: null,
        durationSeconds: null
      });
      return json({ sourceId: source.id, status: "source_ready" });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "source", "video", "upload-url"])) {
      const projectId = path[1];
      const parsed = uploadUrlSchema.parse(body);
      const storageKey = `projects/${projectId}/source/${newId()}-${parsed.filename}`;
      return json({ uploadUrl: `/api/mock-upload/${storageKey}`, storageKey });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "source", "video", "complete"])) {
      const projectId = path[1];
      const parsed = uploadCompleteSchema.parse(body);
      const source = createVideoSource({
        projectId,
        sourceType: "video_file",
        youtubeUrl: null,
        originalFilename: parsed.filename,
        mimeType: parsed.mimeType,
        fileSizeBytes: parsed.fileSizeBytes,
        storageKey: parsed.storageKey,
        geminiFileUri: null,
        durationSeconds: null
      });
      return json({ sourceId: source.id, status: "source_ready" });
    }

    if (method === "PUT" && matches(path, ["projects", ":projectId", "settings"])) {
      const projectId = path[1];
      const parsed = settingsSchema.parse(body);
      const settings = upsertSettings(projectId, parsed);
      return json({ settings });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "structure-jobs"])) {
      const projectId = path[1];
      const job = startStructureJob(projectId);
      return json({ jobId: job.id, status: job.status });
    }

    if (method === "GET" && matches(path, ["jobs", ":jobId"])) {
      const job = getJob(path[1]);
      if (!job) return notFound();
      return json({ ...job });
    }

    if (method === "POST" && matches(path, ["jobs", ":jobId", "cancel"])) {
      const job = cancelJob(path[1]);
      return json({ jobId: job.id, status: job.status });
    }

    if (method === "GET" && matches(path, ["projects", ":projectId", "slides"])) {
      return json({ slides: listSlides(path[1]).map(serializeSlide) });
    }

    if (method === "PATCH" && matches(path, ["slides", ":slideId"])) {
      const parsed = slidePatchSchema.parse(body);
      const slide = updateSlide(path[1], parsed);
      return json({ slide });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "slides"])) {
      const parsed = slideCreateSchema.parse(body);
      const slides = addSlide(path[1], parsed).map(serializeSlide);
      return json({ slides });
    }

    if (method === "DELETE" && matches(path, ["slides", ":slideId"])) {
      const slides = deleteSlide(path[1]).map(serializeSlide);
      return json({ slides });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "slides", "reorder"])) {
      const parsed = reorderSlidesSchema.parse(body);
      const slides = reorderSlides(path[1], parsed.slideIds).map(serializeSlide);
      return json({ slides });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "image-jobs"])) {
      const job = startImageJob(path[1]);
      return json({ jobId: job.id, status: job.status });
    }

    if (method === "POST" && matches(path, ["slides", ":slideId", "regenerate"])) {
      const parsed = regenerateSchema.parse(body ?? {});
      const slide = await regenerateSlide(path[1], parsed.instruction);
      return json({ slide: serializeSlide(slide) });
    }

    if (method === "POST" && matches(path, ["projects", ":projectId", "export-jobs"])) {
      exportJobSchema.parse(body ?? { exportType: "zip_images" });
      const job = startExportJob(path[1]);
      return json({ jobId: job.id, status: job.status });
    }

    if (method === "GET" && matches(path, ["exports", ":exportId", "download-url"])) {
      const record = getExport(path[1]);
      if (!record) return notFound();
      return json({ downloadUrl: `/api/exports/${record.id}/download`, expiresInSeconds: 300 });
    }

    if (method === "GET" && matches(path, ["exports", ":exportId", "download"])) {
      const record = getExport(path[1]);
      if (!record) return notFound();
      const buffer = readStoredBuffer(record.storageKey);
      const fileName = `slides-${record.projectId}.zip`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (method === "GET" && matches(path, ["assets", ":assetId"])) {
      const asset = getAsset(path[1]);
      if (!asset) return notFound();
      const buffer = readStoredBuffer(asset.storageKey);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: formatApiError(error) }, 400);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

function serializeSlide(slide: ReturnType<typeof listSlides>[number]) {
  return {
    ...slide,
    assetUrl: assetUrl(slide.latestAsset)
  };
}

function matches(path: string[], pattern: string[]): boolean {
  return path.length === pattern.length && pattern.every((segment, index) => segment.startsWith(":") || segment === path[index]);
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function notFound(): NextResponse {
  return json({ error: "Not found" }, 404);
}

function formatApiError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "入力内容を確認してください";
  }
  if (error instanceof SyntaxError) {
    return "リクエスト内容を読み取れませんでした。入力内容を確認してください。";
  }
  return error instanceof Error ? error.message : "エラーが発生しました";
}
