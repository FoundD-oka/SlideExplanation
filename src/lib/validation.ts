import { z } from "zod";
import {
  ACCEPTED_VIDEO_EXTENSIONS,
  ACCEPTED_VIDEO_MIME_TYPES,
  MAX_VIDEO_UPLOAD_BYTES
} from "./constants";

export const createProjectSchema = z.object({
  sourceType: z.enum(["youtube_url", "video_file"])
});

export const youtubeSourceSchema = z.object({
  youtubeUrl: z.string().trim().min(1).refine(isAllowedYouTubeUrl, "YouTube URLを入力してください")
});

const uploadPayloadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(ACCEPTED_VIDEO_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES)
});

export const uploadUrlSchema = uploadPayloadSchema.refine((value) => hasAcceptedExtension(value.filename), {
  message: "対応していない動画形式です",
  path: ["filename"]
});

export const uploadCompleteSchema = uploadPayloadSchema.extend({
  storageKey: z.string().min(1)
}).refine((value) => hasAcceptedExtension(value.filename), {
  message: "対応していない動画形式です",
  path: ["filename"]
});

export const settingsSchema = z.object({
  slideCount: z.number().int().min(5).max(20),
  audience: z.enum(["beginner", "general", "business", "expert"]),
  tone: z.enum(["friendly", "business", "minimal", "positive"]),
  imageSize: z.enum(["2048x1152", "1024x768", "3840x2160"]),
  imageQuality: z.enum(["low", "medium", "high"]).default("medium"),
  outputFormat: z.literal("png").default("png")
});

export const slidePatchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  diagramType: z.enum(["timeline", "concept_map", "comparison", "misunderstanding"]).optional(),
  sourceStartSeconds: z.number().int().min(0).nullable().optional(),
  sourceEndSeconds: z.number().int().min(0).nullable().optional()
});

export const slideCreateSchema = z.object({
  insertAfterSlideNumber: z.number().int().min(0).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  diagramType: z.enum(["timeline", "concept_map", "comparison", "misunderstanding"])
});

export const reorderSlidesSchema = z.object({
  slideIds: z.array(z.string().min(1)).min(1)
});

export const regenerateSchema = z.object({
  instruction: z.string().trim().min(1).nullable().optional()
});

export const exportJobSchema = z.object({
  exportType: z.literal("zip_images")
});

export function isAllowedYouTubeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  const allowedHost =
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com";

  if (!allowedHost) {
    return false;
  }

  if (hostname === "youtu.be") {
    return url.pathname.length > 1;
  }

  if (url.pathname === "/watch") {
    return Boolean(url.searchParams.get("v"));
  }

  return url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/");
}

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
