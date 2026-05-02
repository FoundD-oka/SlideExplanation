import JSZip from "jszip";
import { generateSlideImage, generateStructure, readAsset } from "./ai";
import {
  addJobEvent,
  addSlideAsset,
  createExport,
  createJob,
  getJob,
  getSettings,
  getSlide,
  latestAssetVersion,
  listSlides,
  replaceSlides,
  updateJob,
  updateProject,
  updateSlide,
  updateSlideStatus,
  writeExportBuffer
} from "./store";
import type { Job, SlideWithAsset } from "./types";

const STRUCTURE_DELAY_MS = 600;
const IMAGE_DELAY_MS = 500;

export function startStructureJob(projectId: string): Job {
  const job = createJob(projectId, "structure_generation");
  void runStructureJob(job.id);
  return job;
}

export function startImageJob(projectId: string): Job {
  const totalSlides = listSlides(projectId).length;
  const job = createJob(projectId, "image_generation", totalSlides);
  void runImageJob(job.id);
  return job;
}

export function startExportJob(projectId: string): Job {
  const job = createJob(projectId, "export_zip");
  void runExportJob(job.id);
  return job;
}

export async function regenerateSlide(slideId: string, instruction?: string | null): Promise<SlideWithAsset> {
  const slide = getSlide(slideId);
  if (!slide) {
    throw new Error("スライドが見つかりません");
  }
  const settings = getSettings(slide.projectId);
  if (!settings) {
    throw new Error("設定が保存されていません");
  }

  const updatedPrompt = instruction
    ? `${slide.imagePrompt}\n\nAdditional user instruction: ${instruction}`
    : slide.imagePrompt;
  const preparedSlide = updateSlide(slide.id, {
    imagePrompt: updatedPrompt,
    status: "generating"
  });

  const version = latestAssetVersion(slide.id) + 1;
  const assetInput = await generateSlideImage(preparedSlide, settings, version);
  addSlideAsset(assetInput);
  updateSlideStatus(slide.id, "generated");
  return listSlides(slide.projectId).find((item) => item.id === slide.id)!;
}

async function runStructureJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    return;
  }

  try {
    updateProject(job.projectId, { status: "structure_generating" });
    updateJob(jobId, {
      status: "running",
      currentStep: "analyzing_video",
      progressPercent: 15,
      progressMessage: "動画を解析中",
      startedAt: new Date().toISOString()
    });
    addJobEvent(jobId, "started", "structure_generation started");
    await delay(STRUCTURE_DELAY_MS);

    assertNotCancelled(jobId);
    updateJob(jobId, {
      currentStep: "creating_structure",
      progressPercent: 55,
      progressMessage: "構成を作成中"
    });

    await delay(STRUCTURE_DELAY_MS);
    const result = await generateStructure(job.projectId);
    replaceSlides(job.projectId, result.slides);
    updateProject(job.projectId, { status: "structure_ready", title: result.title });

    updateJob(jobId, {
      status: "succeeded",
      currentStep: "structure_ready",
      progressPercent: 100,
      progressMessage: "構成案を作成しました",
      totalSlides: result.slides.length,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    if (isCancelled(jobId)) {
      updateProject(job.projectId, { status: "cancelled" });
      return;
    }
    const message = error instanceof Error ? error.message : "スライド構成の作成に失敗しました。もう一度お試しください。";
    updateProject(job.projectId, { status: "failed" });
    updateJob(jobId, {
      status: "failed",
      currentStep: "failed",
      errorMessage: message,
      progressMessage: message,
      completedAt: new Date().toISOString()
    });
  }
}

async function runImageJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    return;
  }

  const settings = getSettings(job.projectId);
  if (!settings) {
    updateJob(jobId, {
      status: "failed",
      errorMessage: "設定が保存されていません",
      progressMessage: "設定が保存されていません",
      completedAt: new Date().toISOString()
    });
    return;
  }

  try {
    updateProject(job.projectId, { status: "image_generating" });
    updateJob(jobId, {
      status: "running",
      currentStep: "generating_images",
      progressPercent: 0,
      progressMessage: "画像を生成中",
      startedAt: new Date().toISOString()
    });

    const slides = listSlides(job.projectId);
    let generatedCount = 0;

    for (const slide of slides) {
      assertNotCancelled(jobId);
      updateJob(jobId, {
        currentSlideNumber: slide.slideNumber,
        totalSlides: slides.length,
        progressPercent: Math.round((generatedCount / slides.length) * 90),
        progressMessage: `スライド ${slide.slideNumber}/${slides.length} を生成中`
      });
      updateSlideStatus(slide.id, "generating");

      try {
        const version = latestAssetVersion(slide.id) + 1;
        const latestSlide = getSlide(slide.id);
        if (!latestSlide) {
          throw new Error("スライドが見つかりません");
        }
        const assetInput = await generateSlideImage(latestSlide, settings, version);
        addSlideAsset(assetInput);
        updateSlideStatus(slide.id, "generated");
        generatedCount += 1;
      } catch (error) {
        console.error("Image generation failed", error);
        updateSlideStatus(slide.id, "failed");
        addJobEvent(jobId, "slide_failed", "画像生成に失敗しました", { slideId: slide.id });
      }

      await delay(IMAGE_DELAY_MS);
    }

    updateJob(jobId, {
      currentStep: "finishing",
      progressPercent: 96,
      progressMessage: "仕上げ処理中"
    });
    await delay(STRUCTURE_DELAY_MS);

    updateProject(job.projectId, { status: "review_ready" });
    updateJob(jobId, {
      status: "succeeded",
      currentStep: "review_ready",
      progressPercent: 100,
      progressMessage: "生成が完了しました",
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    if (isCancelled(jobId)) {
      const slides = listSlides(job.projectId);
      slides.filter((slide) => slide.status === "generating").forEach((slide) => updateSlideStatus(slide.id, "ready_for_generation"));
      updateProject(job.projectId, { status: "cancelled" });
      updateJob(jobId, {
        status: "cancelled",
        currentStep: "cancelled",
        progressMessage: "生成をキャンセルしました",
        completedAt: new Date().toISOString()
      });
      return;
    }

    const message = error instanceof Error ? error.message : "一部のスライド画像を生成できませんでした。";
    updateProject(job.projectId, { status: "failed" });
    updateJob(jobId, {
      status: "failed",
      currentStep: "failed",
      errorMessage: message,
      progressMessage: message,
      completedAt: new Date().toISOString()
    });
  }
}

async function runExportJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    return;
  }

  try {
    updateJob(jobId, {
      status: "running",
      currentStep: "exporting_zip",
      progressPercent: 35,
      progressMessage: "ZIPファイルを作成中",
      startedAt: new Date().toISOString()
    });

    const slides = listSlides(job.projectId);
    const zip = new JSZip();
    slides.forEach((slide) => {
      if (!slide.latestAsset) {
        return;
      }
      zip.file(`slide_${slide.slideNumber.toString().padStart(2, "0")}.png`, readAsset(slide.latestAsset));
    });

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const fileName = `video-slide-assistant-${job.projectId}.zip`;
    const written = writeExportBuffer(job.projectId, fileName, buffer);
    const record = createExport({
      projectId: job.projectId,
      exportType: "zip_images",
      storageKey: written.storageKey,
      fileSizeBytes: written.fileSizeBytes,
      status: "ready"
    });

    updateProject(job.projectId, { status: "export_ready" });
    updateJob(jobId, {
      status: "succeeded",
      currentStep: "export_ready",
      progressPercent: 100,
      progressMessage: "書き出しが完了しました",
      exportId: record.id,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ダウンロードファイルの作成に失敗しました。もう一度書き出してください。";
    updateJob(jobId, {
      status: "failed",
      currentStep: "failed",
      errorMessage: message,
      progressMessage: message,
      completedAt: new Date().toISOString()
    });
  }
}

function assertNotCancelled(jobId: string): void {
  if (isCancelled(jobId)) {
    throw new Error("cancelled");
  }
}

function isCancelled(jobId: string): boolean {
  return getJob(jobId)?.status === "cancelled";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
