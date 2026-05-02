"use client";

/* eslint-disable @next/next/no-img-element */

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  Circle,
  Download,
  Edit3,
  Grid2X2,
  GripVertical,
  HelpCircle,
  Info,
  Loader2,
  Maximize2,
  Menu,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Youtube
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DIAGRAM_BADGE_CLASSES,
  DIAGRAM_LABELS,
  IMAGE_SIZE_OPTIONS,
  YOUTUBE_URL_ERROR_MESSAGE,
  formatTimestamp
} from "@/lib/constants";
import { DEFAULT_SLIDE_THEME, SLIDE_THEME_OPTIONS } from "@/lib/slide-theme";
import type { DiagramType, ImageSize, Job, SlideTheme } from "@/lib/types";
import { isAllowedYouTubeUrl } from "@/lib/youtube-url";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;
type SourceTab = "youtube" | "file";
type ReviewMode = "thumbnail" | "list";

type ApiSlide = {
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
  status: string;
  latestAsset: {
    id: string;
    width: number;
    height: number;
    version: number;
    provider: string;
  } | null;
  assetUrl: string | null;
};

type ApiJob = Job;

const primaryCtaClassName =
  "bg-gradient-to-r from-[#7b5cff] via-[#6548ef] to-[#4c2bd9] shadow-[0_16px_34px_rgba(91,54,223,0.30)] hover:from-[#866fff] hover:via-[#6d50f5] hover:to-[#5634e4] active:translate-y-px disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:active:translate-y-0";

export default function Home() {
  const [step, setStep] = useState<StepId>(1);
  const [sourceTab, setSourceTab] = useState<SourceTab>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState(10);
  const [theme, setTheme] = useState<SlideTheme>(DEFAULT_SLIDE_THEME);
  const [imageSize, setImageSize] = useState<ImageSize>("2048x1152");
  const [slides, setSlides] = useState<ApiSlide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [structureJobId, setStructureJobId] = useState<string | null>(null);
  const [imageJobId, setImageJobId] = useState<string | null>(null);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [imageJob, setImageJob] = useState<ApiJob | null>(null);
  const [structureJob, setStructureJob] = useState<ApiJob | null>(null);
  const [exportJob, setExportJob] = useState<ApiJob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("thumbnail");
  const [instruction, setInstruction] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null,
    [slides, selectedSlideId]
  );

  useEffect(() => {
    if (!structureJobId) return;
    const timer = window.setInterval(async () => {
      const job = await api<ApiJob>(`/api/jobs/${structureJobId}`);
      setStructureJob(job);
      if (job.status === "succeeded") {
        window.clearInterval(timer);
        await refreshSlides(projectId, setSlides, setSelectedSlideId);
      }
      if (job.status === "failed" || job.status === "cancelled") {
        window.clearInterval(timer);
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [structureJobId, projectId]);

  useEffect(() => {
    if (!imageJobId) return;
    const timer = window.setInterval(async () => {
      const job = await api<ApiJob>(`/api/jobs/${imageJobId}`);
      setImageJob(job);
      if (job.status === "succeeded") {
        window.clearInterval(timer);
        await refreshSlides(projectId, setSlides, setSelectedSlideId);
        window.setTimeout(() => setStep(5), 600);
      }
      if (job.status === "failed" || job.status === "cancelled") {
        window.clearInterval(timer);
        await refreshSlides(projectId, setSlides, setSelectedSlideId);
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [imageJobId, projectId]);

  useEffect(() => {
    if (!exportJobId) return;
    const timer = window.setInterval(async () => {
      const job = await api<ApiJob>(`/api/jobs/${exportJobId}`);
      setExportJob(job);
      if (job.status === "succeeded" && job.exportId) {
        window.clearInterval(timer);
        const result = await api<{ downloadUrl: string }>(`/api/exports/${job.exportId}/download-url`);
        setDownloadUrl(result.downloadUrl);
      }
      if (job.status === "failed") {
        window.clearInterval(timer);
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [exportJobId]);

  async function goToSettings() {
    setError(null);
    const trimmedYoutubeUrl = youtubeUrl.trim();
    if (sourceTab === "youtube") {
      if (!trimmedYoutubeUrl) {
        setError("YouTube URLを入力してください");
        return;
      }
      if (!isAllowedYouTubeUrl(trimmedYoutubeUrl)) {
        setError(YOUTUBE_URL_ERROR_MESSAGE);
        return;
      }
    }
    setIsBusy(true);
    try {
      const sourceType = sourceTab === "youtube" ? "youtube_url" : "video_file";
      const project = await api<{ projectId: string }>("/api/projects", {
        method: "POST",
        body: { sourceType }
      });

      if (sourceTab === "youtube") {
        await api(`/api/projects/${project.projectId}/source/youtube`, {
          method: "POST",
          body: { youtubeUrl: trimmedYoutubeUrl }
        });
      } else {
        if (!selectedFile) {
          throw new Error("動画ファイルを選択してください");
        }
        const upload = await api<{ storageKey: string }>(`/api/projects/${project.projectId}/source/video/upload-url`, {
          method: "POST",
          body: {
            filename: selectedFile.name,
            mimeType: selectedFile.type || inferVideoMimeType(selectedFile.name),
            fileSizeBytes: selectedFile.size
          }
        });
        await api(`/api/projects/${project.projectId}/source/video/complete`, {
          method: "POST",
          body: {
            storageKey: upload.storageKey,
            filename: selectedFile.name,
            mimeType: selectedFile.type || inferVideoMimeType(selectedFile.name),
            fileSizeBytes: selectedFile.size
          }
        });
      }

      setProjectId(project.projectId);
      setStep(2);
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function createStructure() {
    if (!projectId) return;
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/projects/${projectId}/settings`, {
        method: "PUT",
        body: {
          slideCount,
          theme,
          imageSize,
          imageQuality: "medium",
          outputFormat: "png"
        }
      });
      const job = await api<{ jobId: string; status: string }>(`/api/projects/${projectId}/structure-jobs`, {
        method: "POST",
        body: {}
      });
      setStructureJobId(job.jobId);
      setStructureJob(null);
      setStep(3);
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function startImageGeneration() {
    if (!projectId) return;
    setError(null);
    setIsBusy(true);
    try {
      const job = await api<{ jobId: string; status: string }>(`/api/projects/${projectId}/image-jobs`, {
        method: "POST",
        body: {}
      });
      setImageJobId(job.jobId);
      setImageJob(null);
      setStep(4);
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function patchSlide(slideId: string, patch: Partial<ApiSlide>) {
    setSlides((current) => current.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide)));
    try {
      await api(`/api/slides/${slideId}`, { method: "PATCH", body: patch });
    } catch (caught) {
      setError(readError(caught));
    }
  }

  async function addNewSlide() {
    if (!projectId) return;
    const response = await api<{ slides: ApiSlide[] }>(`/api/projects/${projectId}/slides`, {
      method: "POST",
      body: {
        insertAfterSlideNumber: slides.length,
        title: "補足ポイント",
        description: "理解の補助になる内容を追加する",
        diagramType: "concept_map"
      }
    });
    setSlides(response.slides);
    setSelectedSlideId(response.slides.at(-1)?.id ?? null);
  }

  async function removeSlide(slideId: string) {
    const response = await api<{ slides: ApiSlide[] }>(`/api/slides/${slideId}`, { method: "DELETE" });
    setSlides(response.slides);
    setSelectedSlideId(response.slides[0]?.id ?? null);
  }

  async function moveSlide(slideId: string, direction: -1 | 1) {
    if (!projectId) return;
    const currentIndex = slides.findIndex((slide) => slide.id === slideId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= slides.length) return;
    const next = [...slides];
    const [moving] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moving);
    setSlides(next.map((slide, index) => ({ ...slide, slideNumber: index + 1 })));
    const response = await api<{ slides: ApiSlide[] }>(`/api/projects/${projectId}/slides/reorder`, {
      method: "POST",
      body: { slideIds: next.map((slide) => slide.id) }
    });
    setSlides(response.slides);
  }

  async function cancelGeneration() {
    if (!imageJobId) return;
    const job = await api<ApiJob>(`/api/jobs/${imageJobId}/cancel`, { method: "POST", body: {} });
    setImageJob(job);
  }

  async function regenerateSelected(useInstruction: boolean) {
    if (!selectedSlide) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await api<{ slide: ApiSlide }>(`/api/slides/${selectedSlide.id}/regenerate`, {
        method: "POST",
        body: { instruction: useInstruction ? instruction : null }
      });
      setSlides((current) => current.map((slide) => (slide.id === result.slide.id ? result.slide : slide)));
      setSelectedSlideId(result.slide.id);
      setInstruction("");
      setIsAdjusting(false);
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function startExport() {
    if (!projectId) return;
    setError(null);
    setDownloadUrl(null);
    setStep(6);
    const job = await api<{ jobId: string }>(`/api/projects/${projectId}/export-jobs`, {
      method: "POST",
      body: { exportType: "zip_images" }
    });
    setExportJobId(job.jobId);
    setExportJob(null);
  }

  function resetFlow() {
    setStep(1);
    setSourceTab("youtube");
    setYoutubeUrl("");
    setSelectedFile(null);
    setProjectId(null);
    setSlides([]);
    setSelectedSlideId(null);
    setStructureJobId(null);
    setImageJobId(null);
    setExportJobId(null);
    setImageJob(null);
    setStructureJob(null);
    setExportJob(null);
    setDownloadUrl(null);
    setError(null);
  }

  return (
    <main className="min-h-[100dvh] sm:px-6 sm:py-6 lg:min-h-screen lg:px-8 lg:py-5">
      <div className="mx-auto flex max-w-7xl flex-col items-center lg:gap-6">
        <div className="grid w-full max-w-6xl items-start lg:gap-6 lg:grid-cols-[minmax(0,1fr)_430px_minmax(0,1fr)]">
          <ContextPanel step={step} slides={slides} imageSize={imageSize} />
          <PhoneFrame>
            {step === 1 && (
              <InputScreen
                sourceTab={sourceTab}
                setSourceTab={setSourceTab}
                youtubeUrl={youtubeUrl}
                setYoutubeUrl={setYoutubeUrl}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                fileInputRef={fileInputRef}
                onNext={goToSettings}
                isBusy={isBusy}
                error={error}
              />
            )}
            {step === 2 && (
              <SettingsScreen
                slideCount={slideCount}
                setSlideCount={setSlideCount}
                theme={theme}
                setTheme={setTheme}
                imageSize={imageSize}
                setImageSize={setImageSize}
                onBack={() => setStep(1)}
                onNext={createStructure}
                isBusy={isBusy}
                error={error}
              />
            )}
            {step === 3 && (
              <StructureScreen
                job={structureJob}
                slides={slides}
                onBack={() => setStep(2)}
                onPatchSlide={patchSlide}
                onAddSlide={addNewSlide}
                onRemoveSlide={removeSlide}
                onMoveSlide={moveSlide}
                onGenerate={startImageGeneration}
                onRefreshStructure={createStructure}
                isBusy={isBusy}
                error={error}
              />
            )}
            {step === 4 && (
              <GenerationScreen
                job={imageJob}
                slides={slides}
                onCancel={cancelGeneration}
                onBackToStructure={() => setStep(3)}
              />
            )}
            {step === 5 && (
              <ReviewScreen
                slides={slides}
                selectedSlide={selectedSlide}
                selectedSlideId={selectedSlideId}
                setSelectedSlideId={setSelectedSlideId}
                reviewMode={reviewMode}
                setReviewMode={setReviewMode}
                isAdjusting={isAdjusting}
                setIsAdjusting={setIsAdjusting}
                instruction={instruction}
                setInstruction={setInstruction}
                onRegenerate={() => regenerateSelected(false)}
                onRegenerateWithInstruction={() => regenerateSelected(true)}
                onBackToStructure={() => setStep(3)}
                onExport={startExport}
                isBusy={isBusy}
                error={error}
              />
            )}
            {step === 6 && (
              <ExportScreen
                slides={slides}
                imageSize={imageSize}
                job={exportJob}
                downloadUrl={downloadUrl}
                onBack={() => setStep(5)}
                onReset={resetFlow}
              />
            )}
          </PhoneFrame>
          <PreviewPanel slides={slides} selectedSlide={selectedSlide} step={step} />
        </div>
      </div>
    </main>
  );
}

function ContextPanel({ step, slides, imageSize }: { step: StepId; slides: ApiSlide[]; imageSize: ImageSize }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-5 space-y-4">
        <div className="rounded-[8px] border border-white/80 bg-white/75 p-4 shadow-soft backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-600">MVP Flow</p>
          <h1 className="mt-2 text-2xl font-bold">Video Slide Assistant</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            入力、設定、構成確認、画像生成、レビュー、ZIP書き出しまでを1本の導線で実装しています。
          </p>
        </div>
        <div className="rounded-[8px] border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">現在のステップ</span>
            <span className="font-bold text-brand-600">{step}/6</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7b5cff] to-[#4c2bd9]" style={{ width: `${(step / 6) * 100}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="スライド" value={`${slides.length || 10}枚`} />
          <Metric label="生成画像サイズ" value={imageSize} />
        </div>
      </div>
    </aside>
  );
}

function PreviewPanel({ slides, selectedSlide, step }: { slides: ApiSlide[]; selectedSlide: ApiSlide | null; step: StepId }) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-5 rounded-[8px] border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">プレビュー</p>
          <Grid2X2 className="h-4 w-4 text-slate-400" />
        </div>
        <div className="mt-4 aspect-[16/9] overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50">
          {selectedSlide?.assetUrl ? (
            <img src={selectedSlide.assetUrl} alt={selectedSlide.title} className="h-full w-full object-cover" />
          ) : (
            <SlidePlaceholder slide={selectedSlide} />
          )}
        </div>
        <p className="mt-3 text-sm font-bold">{selectedSlide?.title ?? "生成前のプレビュー"}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {step < 5 ? "レビュー前は構成内容をもとにした仮表示です。" : "生成済み画像の最新版を表示します。"}
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {slides.slice(0, 8).map((slide) => (
            <div key={slide.id} className="aspect-[16/9] overflow-hidden rounded-[6px] border border-slate-200 bg-slate-50">
              {slide.assetUrl ? <img src={slide.assetUrl} alt="" className="h-full w-full object-cover" /> : <SlidePlaceholder slide={slide} dense />}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full sm:max-w-[440px] lg:max-w-[390px]">
      <div className="relative flex min-h-[100dvh] flex-col bg-white sm:min-h-[calc(100dvh-3rem)] sm:rounded-[20px] sm:border sm:border-slate-200 sm:shadow-soft lg:h-[812px] lg:min-h-0 lg:overflow-hidden lg:rounded-[34px] lg:shadow-phone">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <HomeIndicator />
      </div>
    </section>
  );
}

function HomeIndicator() {
  return (
    <div className="absolute bottom-3 left-1/2 hidden h-1 w-28 -translate-x-1/2 rounded-full bg-black lg:block" />
  );
}

function ScreenHeader({
  title,
  onBack,
  action
}: {
  title: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-100 px-5">
      <button className="grid h-9 w-9 place-items-center rounded-full text-slate-900" onClick={onBack} type="button">
        {onBack ? <ChevronLeft className="h-5 w-5" /> : null}
      </button>
      <h2 className="text-base font-bold">{title}</h2>
      <div className="grid h-9 min-w-9 place-items-center text-sm font-bold text-brand-600">{action}</div>
    </div>
  );
}

function ScreenBody({ children, bottom }: { children: React.ReactNode; bottom?: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="phone-scroll flex-1 overflow-y-auto px-5 pb-4 pt-4">{children}</div>
      {bottom ? (
        <div className="border-t border-slate-100 bg-white px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] lg:pb-9">
          {bottom}
        </div>
      ) : null}
    </div>
  );
}

function InputScreen({
  sourceTab,
  setSourceTab,
  youtubeUrl,
  setYoutubeUrl,
  selectedFile,
  setSelectedFile,
  fileInputRef,
  onNext,
  isBusy,
  error
}: {
  sourceTab: SourceTab;
  setSourceTab: (tab: SourceTab) => void;
  youtubeUrl: string;
  setYoutubeUrl: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onNext: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  const trimmedYoutubeUrl = youtubeUrl.trim();
  const youtubeUrlError = trimmedYoutubeUrl && !isAllowedYouTubeUrl(trimmedYoutubeUrl) ? YOUTUBE_URL_ERROR_MESSAGE : null;
  const canContinue = sourceTab === "youtube" ? trimmedYoutubeUrl.length > 0 && !youtubeUrlError : Boolean(selectedFile);
  return (
    <>
      <ScreenBody
        bottom={
          <>
            <PrimaryButton disabled={!canContinue || isBusy} onClick={onNext}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              設定へ進む
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
            <p className="mt-4 text-center text-xs text-slate-500">公開YouTube URLのみ対応。限定公開・非公開の動画は、動画ファイルとしてアップロードしてください。</p>
          </>
        }
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">動画を入力</h2>
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="mt-6 grid grid-cols-2 border-b border-slate-200 text-sm font-bold">
          <TabButton active={sourceTab === "youtube"} onClick={() => setSourceTab("youtube")}>
            YouTube URL
          </TabButton>
          <TabButton active={sourceTab === "file"} onClick={() => setSourceTab("file")}>
            動画ファイル
          </TabButton>
        </div>

        {sourceTab === "youtube" ? (
          <div className="pt-14 text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-rose-50">
              <Youtube className="h-12 w-12 fill-red-600 text-red-600" />
            </div>
            <p className="mt-8 text-sm font-medium">YouTube URLを貼り付けてください</p>
            <input
              aria-invalid={Boolean(youtubeUrlError)}
              autoCapitalize="none"
              className={`mt-4 h-11 w-full rounded-[8px] border px-3 text-sm outline-none focus:ring-2 ${
                youtubeUrlError
                  ? "border-rose-300 bg-rose-50 focus:border-rose-500 focus:ring-rose-100"
                  : "border-slate-200 focus:border-brand-500 focus:ring-brand-100"
              }`}
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=xxxxx"
              spellCheck={false}
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
            />
            {youtubeUrlError ? <p className="mt-3 text-left text-xs leading-5 text-rose-700">{youtubeUrlError}</p> : null}
          </div>
        ) : (
          <div className="pt-12">
            <button
              className="flex h-56 w-full flex-col items-center justify-center rounded-[8px] border border-dashed border-brand-300 bg-brand-50/60 px-6 text-center"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/avi"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <Upload className="h-10 w-10 text-brand-600" />
              <span className="mt-4 text-sm font-bold">{selectedFile ? selectedFile.name : "動画ファイルを選択"}</span>
              <span className="mt-2 text-xs leading-5 text-slate-500">対応形式：MP4 / MOV / AVI（最大2GB）</span>
            </button>
          </div>
        )}

        <InfoNote>
          公開YouTube URLのみ対応。限定公開・非公開の動画は、動画ファイルとしてアップロードしてください。
        </InfoNote>
        <ErrorMessage message={error} />
      </ScreenBody>
    </>
  );
}

function SettingsScreen(props: {
  slideCount: number;
  setSlideCount: (value: number) => void;
  theme: SlideTheme;
  setTheme: (value: SlideTheme) => void;
  imageSize: ImageSize;
  setImageSize: (value: ImageSize) => void;
  onBack: () => void;
  onNext: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  return (
    <>
      <ScreenHeader title="設定を選ぶ" onBack={props.onBack} />
      <ScreenBody
        bottom={
          <PrimaryButton onClick={props.onNext} disabled={props.isBusy}>
            {props.isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            構成を作成する
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        }
      >
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold">
              スライド枚数
              <span className="text-xs font-medium text-slate-500">（目安）</span>
            </div>
            <div className="mt-2 flex h-12 items-center justify-between rounded-[8px] border border-slate-200 px-3">
              <span className="font-bold">{props.slideCount}枚</span>
              <div className="flex items-center gap-2">
                <IconButton label="減らす" onClick={() => props.setSlideCount(Math.max(5, props.slideCount - 1))}>
                  <Minus className="h-4 w-4" />
                </IconButton>
                <IconButton label="増やす" onClick={() => props.setSlideCount(Math.min(20, props.slideCount + 1))}>
                  <Plus className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold">スライドテーマ</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">サンプルを見て、動画に合う見せ方を選んでください。</p>
            <div className="mt-3 space-y-3">
              {SLIDE_THEME_OPTIONS.map((option) => (
                <ThemeCard
                  key={option.value}
                  active={props.theme === option.value}
                  label={option.label}
                  recommendedFor={option.recommendedFor}
                  sampleSrc={option.sampleSrc}
                  shortDescription={option.shortDescription}
                  onClick={() => props.setTheme(option.value)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold">生成画像サイズ</p>
            <div className="mt-2 space-y-2">
              {IMAGE_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => props.setImageSize(option.value)}
                  className={`flex min-h-[55px] w-full items-center gap-3 rounded-[8px] border px-3 text-left ${
                    props.imageSize === option.value
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {props.imageSize === option.value ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-[#7b5cff] to-[#4c2bd9] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <Circle className="h-5 w-5 text-slate-400" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-bold">{option.label}</span>
                    <span className="ml-2 text-xs text-slate-500">{option.value}</span>
                    {option.helper ? <span className="mt-1 block text-xs text-slate-500">{option.helper}</span> : null}
                  </span>
                  {option.badge ? <span className="rounded-[6px] bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700">{option.badge}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ErrorMessage message={props.error} />
      </ScreenBody>
    </>
  );
}

function ThemeCard({
  active,
  label,
  recommendedFor,
  sampleSrc,
  shortDescription,
  onClick
}: {
  active: boolean;
  label: string;
  recommendedFor: string;
  sampleSrc: string;
  shortDescription: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[116px] w-full gap-3 rounded-[8px] border p-2 text-left transition ${
        active ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 bg-white"
      }`}
    >
      <span className="relative h-[78px] w-[104px] shrink-0 overflow-hidden rounded-[6px] border border-slate-200 bg-slate-50">
        <img className="h-full w-full object-cover" src={sampleSrc} alt={`${label}のサンプル`} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          {active ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7b5cff] to-[#4c2bd9] text-white">
              <Check className="h-3 w-3" />
            </span>
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 text-sm font-bold leading-5">{label}</span>
        </span>
        <span className="mt-1 text-xs leading-5 text-slate-600">{shortDescription}</span>
        <span className="mt-auto pt-2 text-[11px] font-medium leading-4 text-slate-500">向き: {recommendedFor}</span>
      </span>
    </button>
  );
}

function StructureScreen(props: {
  job: ApiJob | null;
  slides: ApiSlide[];
  onBack: () => void;
  onPatchSlide: (slideId: string, patch: Partial<ApiSlide>) => void;
  onAddSlide: () => void;
  onRemoveSlide: (slideId: string) => void;
  onMoveSlide: (slideId: string, direction: -1 | 1) => void;
  onGenerate: () => void;
  onRefreshStructure: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  const isGenerating = !props.job || props.job.status === "queued" || props.job.status === "running";
  return (
    <>
      <ScreenHeader title="構成を確認・編集" onBack={props.onBack} action={<span>完了</span>} />
      <ScreenBody
        bottom={
          props.slides.length > 0 ? (
            <PrimaryButton onClick={props.onGenerate} disabled={props.isBusy}>
              画像を生成する
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          ) : null
        }
      >
        {isGenerating && props.slides.length === 0 ? (
          <LoadingBlock title={props.job?.progressMessage ?? "構成を作成中"} description="AIが動画内容からスライド構成案を作っています。" />
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-600">
              AIが作成したスライド構成です。必要に応じて編集・並べ替えができます。
            </p>
            <p className="mt-3 text-sm text-slate-600">提案スライド：{props.slides.length}枚</p>
            <div className="mt-3 space-y-2">
              {props.slides.map((slide, index) => (
                <StructureCard
                  key={slide.id}
                  slide={slide}
                  canMoveUp={index > 0}
                  canMoveDown={index < props.slides.length - 1}
                  onPatch={props.onPatchSlide}
                  onRemove={props.onRemoveSlide}
                  onMove={props.onMoveSlide}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SecondaryButton onClick={props.onAddSlide}>
                <Plus className="h-4 w-4" />
                スライドを追加
              </SecondaryButton>
              <SecondaryButton onClick={props.onRefreshStructure}>
                <RotateCw className="h-4 w-4" />
                構成案の再作成
              </SecondaryButton>
            </div>
            <p className="mt-3 text-xs text-slate-500">スライドをタップすると、内容を編集できます</p>
          </>
        )}
        <ErrorMessage message={props.error ?? props.job?.errorMessage ?? null} />
      </ScreenBody>
    </>
  );
}

function StructureCard({
  slide,
  canMoveUp,
  canMoveDown,
  onPatch,
  onRemove,
  onMove
}: {
  slide: ApiSlide;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (slideId: string, patch: Partial<ApiSlide>) => void;
  onRemove: (slideId: string) => void;
  onMove: (slideId: string, direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-5 w-5 shrink-0 text-slate-400" />
        <button className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold" type="button" onClick={() => setOpen(!open)}>
          {slide.slideNumber}
        </button>
        <button className="min-w-0 flex-1 text-left" type="button" onClick={() => setOpen(!open)}>
          <p className="truncate text-sm font-bold">{slide.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-[5px] px-2 py-0.5 text-[10px] font-bold ${DIAGRAM_BADGE_CLASSES[slide.diagramType]}`}>
              {DIAGRAM_LABELS[slide.diagramType]}
            </span>
            <span className="text-xs text-slate-500">{formatTimestamp(slide.sourceStartSeconds, slide.sourceEndSeconds)}</span>
          </div>
        </button>
        <IconButton label="編集" onClick={() => setOpen(!open)}>
          <Edit3 className="h-4 w-4" />
        </IconButton>
        <IconButton label="削除" onClick={() => onRemove(slide.id)}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <input
            className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm outline-none focus:border-brand-500"
            value={slide.title}
            onChange={(event) => onPatch(slide.id, { title: event.target.value })}
          />
          <textarea
            className="h-20 w-full resize-none rounded-[8px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            value={slide.description}
            onChange={(event) => onPatch(slide.id, { description: event.target.value })}
          />
          <select
            className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm outline-none focus:border-brand-500"
            value={slide.diagramType}
            onChange={(event) => onPatch(slide.id, { diagramType: event.target.value as DiagramType })}
          >
            {Object.entries(DIAGRAM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton disabled={!canMoveUp} onClick={() => onMove(slide.id, -1)}>
              <ArrowUp className="h-4 w-4" />
              上へ
            </SecondaryButton>
            <SecondaryButton disabled={!canMoveDown} onClick={() => onMove(slide.id, 1)}>
              <ArrowDown className="h-4 w-4" />
              下へ
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GenerationScreen(props: {
  job: ApiJob | null;
  slides: ApiSlide[];
  onCancel: () => void;
  onBackToStructure: () => void;
}) {
  const current = props.job?.currentSlideNumber ?? 1;
  const total = props.job?.totalSlides ?? (props.slides.length || 10);
  const progress = props.job?.progressPercent ?? 0;
  const cancelled = props.job?.status === "cancelled";
  return (
    <>
      <ScreenBody
        bottom={
          <>
            {cancelled ? (
              <PrimaryButton onClick={props.onBackToStructure}>構成に戻って編集</PrimaryButton>
            ) : (
              <SecondaryButton onClick={props.onCancel}>生成をキャンセル</SecondaryButton>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">この画面を閉じても、バックグラウンドで処理を続けます。</p>
          </>
        }
      >
        <h2 className="text-lg font-bold">画像を生成中...</h2>
        <p className="mt-1 text-sm text-slate-600">AIがスライド画像を生成しています</p>
        <div className="mt-7 space-y-4">
          <ProgressRow done label="動画を解析中" status="完了" />
          <ProgressRow done label="構成を作成中" status="完了" />
          <ProgressRow active={!cancelled} label="画像を生成中" status={`スライド ${current}/${total} を生成中`} />
          <ProgressRow label="仕上げ処理中" status={progress >= 96 ? "処理中" : "待機中"} />
        </div>
        <div className="mt-10 rounded-[8px] border border-slate-200 bg-gradient-to-br from-white to-brand-50 p-6 text-center safe-shadow">
          <Sparkles className="mx-auto h-12 w-12 text-brand-600" />
          <p className="mt-6 text-lg font-bold">
            スライド <span className="text-brand-600">{current}/{total}</span> を生成中
          </p>
          <span className="mt-3 inline-flex rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">進捗 {progress}%</span>
          <p className="mt-6 text-left text-xs leading-5 text-slate-600">この画面を閉じても、バックグラウンドで処理を続けます。</p>
        </div>
      </ScreenBody>
    </>
  );
}

function ReviewScreen(props: {
  slides: ApiSlide[];
  selectedSlide: ApiSlide | null;
  selectedSlideId: string | null;
  setSelectedSlideId: (id: string) => void;
  reviewMode: ReviewMode;
  setReviewMode: (mode: ReviewMode) => void;
  isAdjusting: boolean;
  setIsAdjusting: (value: boolean) => void;
  instruction: string;
  setInstruction: (value: string) => void;
  onRegenerate: () => void;
  onRegenerateWithInstruction: () => void;
  onBackToStructure: () => void;
  onExport: () => void;
  isBusy: boolean;
  error: string | null;
}) {
  const [previewSlideId, setPreviewSlideId] = useState<string | null>(null);
  const previewSlide = useMemo(
    () => props.slides.find((slide) => slide.id === previewSlideId && slide.assetUrl) ?? null,
    [previewSlideId, props.slides]
  );

  useEffect(() => {
    if (!previewSlide) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewSlideId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewSlide]);

  const openSlidePreview = (slide: ApiSlide) => {
    props.setSelectedSlideId(slide.id);
    if (slide.assetUrl) {
      setPreviewSlideId(slide.id);
    }
  };

  return (
    <>
      <ScreenHeader title="レビュー" action={<Grid2X2 className="h-5 w-5 text-slate-900" />} />
      <ScreenBody
        bottom={
          <>
            <div className="grid grid-cols-3 gap-2">
              <SecondaryButton onClick={props.onRegenerate} disabled={!props.selectedSlide || props.isBusy}>
                <RotateCw className="h-4 w-4" />
                選択中を再生成
              </SecondaryButton>
              <SecondaryButton onClick={() => props.setIsAdjusting(!props.isAdjusting)} disabled={!props.selectedSlide}>
                <Wand2 className="h-4 w-4" />
                指示を調整して再生成
              </SecondaryButton>
              <SecondaryButton onClick={props.onBackToStructure}>
                <Edit3 className="h-4 w-4" />
                構成を編集
              </SecondaryButton>
            </div>
            <PrimaryButton onClick={props.onExport} className="mt-3">
              書き出しへ
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </>
        }
      >
        <div className="flex items-center justify-between">
          <Menu className="h-5 w-5" />
          <div className="grid grid-cols-2 rounded-[8px] bg-slate-100 p-1 text-sm font-bold">
            <button
              className={`rounded-[6px] px-5 py-2 ${props.reviewMode === "thumbnail" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"}`}
              type="button"
              onClick={() => props.setReviewMode("thumbnail")}
            >
              サムネイル
            </button>
            <button
              className={`rounded-[6px] px-5 py-2 ${props.reviewMode === "list" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"}`}
              type="button"
              onClick={() => props.setReviewMode("list")}
            >
              一覧
            </button>
          </div>
          <span className="w-5" />
        </div>
        <p className="mt-5 text-sm text-slate-600">{props.slides.length}枚のスライドが生成されました</p>
        {props.reviewMode === "thumbnail" ? (
          <div className="mt-3 grid slide-grid gap-3">
            {props.slides.map((slide) => (
              <div
                key={slide.id}
                className={`overflow-hidden rounded-[8px] border bg-white text-left ${props.selectedSlideId === slide.id ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200"}`}
              >
                <button className="group relative block aspect-[16/9] w-full bg-slate-50" type="button" onClick={() => openSlidePreview(slide)} aria-label={`${slide.title}を拡大表示`}>
                  <span className="absolute left-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-[5px] bg-slate-900 text-[11px] font-bold text-white">
                    {slide.slideNumber}
                  </span>
                  {slide.assetUrl ? <img src={slide.assetUrl} alt={slide.title} className="h-full w-full object-cover" /> : <SlidePlaceholder slide={slide} dense />}
                  {slide.assetUrl ? (
                    <span className="absolute bottom-1 right-1 z-10 grid h-7 w-7 place-items-center rounded-[6px] bg-slate-950/75 text-white opacity-90 transition group-hover:bg-gradient-to-br group-hover:from-[#7b5cff] group-hover:to-[#4c2bd9]">
                      <Maximize2 className="h-4 w-4" />
                    </span>
                  ) : null}
                </button>
                <button className="block w-full px-2 py-2 text-left" type="button" onClick={() => props.setSelectedSlideId(slide.id)}>
                  <p className="truncate text-xs font-bold">{slide.title}</p>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {props.slides.map((slide) => (
              <div
                key={slide.id}
                className={`flex w-full items-center gap-3 rounded-[8px] border p-2 text-left ${props.selectedSlideId === slide.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}
              >
                <button className="group relative h-14 w-24 shrink-0 overflow-hidden rounded-[6px] bg-slate-50" type="button" onClick={() => openSlidePreview(slide)} aria-label={`${slide.title}を拡大表示`}>
                  {slide.assetUrl ? <img src={slide.assetUrl} alt={slide.title} className="h-full w-full object-cover" /> : <SlidePlaceholder slide={slide} dense />}
                  <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-[5px] bg-slate-900 text-[11px] font-bold text-white">{slide.slideNumber}</span>
                  {slide.assetUrl ? (
                    <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-[5px] bg-slate-950/75 text-white opacity-90 transition group-hover:bg-gradient-to-br group-hover:from-[#7b5cff] group-hover:to-[#4c2bd9]">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </button>
                <button className="min-w-0 flex-1 text-left" type="button" onClick={() => props.setSelectedSlideId(slide.id)}>
                  <span className="block truncate text-sm font-bold">{slide.title}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{slide.description}</span>
                </button>
              </div>
            ))}
          </div>
        )}
        {props.isAdjusting ? (
          <div className="mt-4 rounded-[8px] border border-brand-200 bg-brand-50 p-3">
            <p className="text-sm font-bold">指示を調整して再生成</p>
            <textarea
              className="mt-2 h-20 w-full resize-none rounded-[8px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="もっとシンプルにして、文字を少なくしてください"
              value={props.instruction}
              onChange={(event) => props.setInstruction(event.target.value)}
            />
            <PrimaryButton className="mt-2" onClick={props.onRegenerateWithInstruction} disabled={!props.instruction.trim() || props.isBusy}>
              {props.isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              再生成する
            </PrimaryButton>
          </div>
        ) : null}
        <ErrorMessage message={props.error} />
      </ScreenBody>
      {previewSlide?.assetUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-labelledby="slide-preview-title" onClick={() => setPreviewSlideId(null)}>
          <div className="relative w-full max-w-6xl rounded-[8px] bg-white p-3 shadow-2xl sm:p-4" onClick={(event) => event.stopPropagation()}>
            <button className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-[8px] bg-white/90 text-slate-900 shadow-sm transition hover:bg-slate-100" type="button" onClick={() => setPreviewSlideId(null)} aria-label="閉じる">
              <X className="h-5 w-5" />
            </button>
            <div className="overflow-hidden rounded-[6px] bg-slate-100">
              <img src={previewSlide.assetUrl} alt={previewSlide.title} className="mx-auto max-h-[calc(100vh-10rem)] w-full object-contain" />
            </div>
            <div className="mt-3 flex items-start gap-3 pr-12">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-slate-900 text-sm font-bold text-white">{previewSlide.slideNumber}</span>
              <div className="min-w-0">
                <h3 id="slide-preview-title" className="truncate text-sm font-bold text-slate-900">{previewSlide.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{previewSlide.description}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ExportScreen(props: {
  slides: ApiSlide[];
  imageSize: ImageSize;
  job: ApiJob | null;
  downloadUrl: string | null;
  onBack: () => void;
  onReset: () => void;
}) {
  const ready = Boolean(props.downloadUrl);
  return (
    <>
      <ScreenHeader title="書き出し完了" onBack={props.onBack} />
      <ScreenBody>
        <div className="pt-8 text-center">
          <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#8b75ff] to-[#4c2bd9] text-white shadow-soft">
            {ready ? <Check className="h-12 w-12" /> : <Loader2 className="h-10 w-10 animate-spin" />}
          </div>
          <h2 className="mt-8 text-xl font-bold">{ready ? "書き出しが完了しました！" : "書き出し中です"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {ready ? `${props.slides.length}枚のスライドを出力しました` : props.job?.progressMessage ?? "ZIPファイルを作成中"}
          </p>
        </div>
        <div className="mt-8 rounded-[8px] bg-slate-50 p-5">
          <p className="text-sm font-bold">出力内容</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">スライド枚数</span>
              <span className="font-medium">{props.slides.length}枚</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">生成画像サイズ</span>
              <span className="font-medium">{props.imageSize}</span>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <p className="text-sm font-bold">一括ダウンロード</p>
          {props.downloadUrl ? (
            <a
              className={`mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-bold text-white transition ${primaryCtaClassName}`}
              download="slide-images.zip"
              href={props.downloadUrl}
            >
              <Download className="h-5 w-5" />
              画像を一括ダウンロード（ZIP形式）
            </a>
          ) : (
            <button className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[8px] bg-slate-300 px-4 text-sm font-bold text-white" type="button" disabled>
              <Loader2 className="h-5 w-5 animate-spin" />
              ZIPを作成中
            </button>
          )}
        </div>
        <div className="mt-5 grid gap-2">
          {["PowerPoint（.pptx）出力：準備中", "PDF出力：準備中", "Figma連携：準備中", "HTML資料化：準備中"].map((label) => (
            <button key={label} className="h-10 rounded-[8px] border border-slate-200 bg-slate-50 text-xs font-bold text-slate-400" disabled type="button">
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          <SecondaryButton onClick={props.onBack}>レビューへ戻る</SecondaryButton>
          <SecondaryButton onClick={props.onReset}>別の動画で作る</SecondaryButton>
        </div>
      </ScreenBody>
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 border-b-2 text-center ${active ? "border-brand-600 text-brand-600" : "border-transparent text-slate-700"}`}
    >
      {children}
    </button>
  );
}

function ProgressRow({ label, status, done, active }: { label: string; status: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-6 w-6 place-items-center rounded-full text-white ${done ? "bg-emerald-500" : active ? "bg-gradient-to-br from-[#7b5cff] to-[#4c2bd9]" : "bg-slate-300"}`}>
        {done ? <Check className="h-4 w-4" /> : active ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        {active ? <span className="block text-xs text-slate-500">{status}</span> : null}
      </span>
      {!active ? <span className="text-xs text-slate-500">{status}</span> : null}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = ""
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed ${primaryCtaClassName} ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  className = ""
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-[#ded7ff] bg-gradient-to-r from-white via-white to-[#f2efff] px-3 text-center text-xs font-bold text-brand-700 transition hover:from-[#fbfaff] hover:to-[#ebe5ff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:from-slate-100 disabled:via-slate-100 disabled:to-slate-100 disabled:text-slate-400 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      title={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 flex items-start gap-3 text-left">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
      <p className="text-xs leading-5 text-slate-700">{children}</p>
    </div>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{message}</p>;
}

function LoadingBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" />
        <h2 className="mt-5 text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function SlidePlaceholder({ slide, dense }: { slide: ApiSlide | null; dense?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="h-2 w-12 rounded-full bg-slate-900" />
        <span className="h-5 w-5 rounded-[5px] bg-gradient-to-br from-[#7b5cff] to-[#4c2bd9]" />
      </div>
      <div className="mt-auto grid grid-cols-3 items-end gap-1">
        <span className="h-8 rounded-[5px] bg-slate-100 ring-1 ring-slate-200" />
        <span className="h-12 rounded-[5px] bg-slate-100 ring-1 ring-slate-200" />
        <span className="h-9 rounded-[5px] bg-slate-100 ring-1 ring-slate-200" />
      </div>
      {!dense ? <p className="mt-3 truncate text-xs font-bold text-slate-700">{slide?.title ?? "生成前のスライド"}</p> : null}
    </div>
  );
}

async function refreshSlides(
  projectId: string | null,
  setSlides: (slides: ApiSlide[]) => void,
  setSelectedSlideId: (id: string | null) => void
) {
  if (!projectId) return;
  const response = await api<{ slides: ApiSlide[] }>(`/api/projects/${projectId}/slides`);
  setSlides(response.slides);
  setSelectedSlideId(response.slides[0]?.id ?? null);
}

async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof data === "object" && data && "error" in data ? String(data.error) : "リクエストに失敗しました");
  }
  return data as T;
}

function inferVideoMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".avi")) return "video/avi";
  return "video/mp4";
}

function readError(caught: unknown): string {
  return caught instanceof Error ? caught.message : "エラーが発生しました";
}
