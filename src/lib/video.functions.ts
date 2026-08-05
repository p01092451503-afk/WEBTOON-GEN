import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VideoTaskState } from "@/lib/video.server";

const startSchema = z.object({
  workLabel: z.string().default("V1"),
  /** 영상 생성 프로바이더. 기본 엔진은 Seedance 2.0이다. */
  provider: z.enum(["auto", "seedance"]).default("seedance"),
  mode: z.enum(["t2v", "i2v"]).default("t2v"),

  finalPrompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional(),
  rawPrompt: z.string().max(4000).optional(),
  promptEdited: z.boolean().default(false),
  aspectRatio: z.string().default("16:9"),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  durationSeconds: z.number().int().min(3).max(12).default(10),
  cameraFixed: z.boolean().default(false),
  seed: z.number().int().nullable().optional(),
  /** character-refs 버킷의 참고 이미지 및 영상 추출 프레임. 1개면 시작 프레임, 여러 개면 모두 참고 미디어다. */
  imagePaths: z.array(z.string()).max(8).default([]),
  options: z.record(z.any()).default({}),
});

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error("UNAUTHORIZED_NO_TENANT");
    const tenantId = profile.tenant_id as string;

    const prompt = data.finalPrompt.trim();
    const { DEFAULT_VIDEO_NEGATIVE_PROMPT } = await import("@/lib/video-constants");
    const negativePrompt = data.negativePrompt?.trim() || DEFAULT_VIDEO_NEGATIVE_PROMPT;
    if (!prompt) throw new Error("EMPTY_PROMPT");

    const { moderateVideoPrompt } = await import("@/lib/video-moderation.server");
    const moderation = await moderateVideoPrompt(prompt);
    if (moderation.status === "blocked")
      throw new Error(`CONTENT_BLOCKED: ${moderation.reason || moderation.categories.join(", ")}`);

    const seed = data.seed ?? null;

    const { data: row, error: insErr } = await supabase
      .from("video_generations")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        work_label: data.workLabel,
        status: "running",
        mode: data.mode,
        final_prompt: prompt,
        negative_prompt: negativePrompt,
        raw_prompt: data.rawPrompt ?? null,
        prompt_edited: data.promptEdited,
        aspect_ratio: data.aspectRatio,
        resolution: data.resolution,
        duration_seconds: data.durationSeconds,
        camera_fixed: data.cameraFixed,
        seed,
        image_paths: data.imagePaths,
        options: data.options,
        moderation_status: moderation.status,
        moderation_details: moderation,
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(`DB_INSERT_VIDEO_FAILED: ${insErr?.message ?? ""}`);
    const videoId = row.id as string;

    try {
      const signedUrls: string[] = [];
      for (const p of data.imagePaths) {
        const { data: signed, error: sErr } = await supabase.storage
          .from("character-refs")
          .createSignedUrl(p, 3600);
        if (sErr || !signed?.signedUrl) throw new Error(`SIGNED_URL_FAILED: ${p}`);
        signedUrls.push(signed.signedUrl);
      }

      const provider = "seedance";
      let taskId: string;
      let model: string;
      let modelVersion: string | null;

      console.info("[video-generation-dispatch]", {
        videoGenerationId: videoId,
        provider,
        mode: data.mode,
        prompt,
        negative_prompt: negativePrompt,
      });

      const { buildSeedanceText, createVideoTask } = await import("@/lib/video.server");
      const useFirstFrame = signedUrls.length === 1;
      const started = await createVideoTask({
        text: buildSeedanceText({
          prompt,
          aspectRatio: data.aspectRatio,
          resolution: data.resolution,
          durationSeconds: data.durationSeconds,
          cameraFixed: data.cameraFixed,
          seed,
          hasFirstFrame: useFirstFrame,
        }),
        firstFrameUrl: useFirstFrame ? signedUrls[0] : null,
        referenceImageUrls: signedUrls,
        aspectRatio: data.aspectRatio,
        resolution: data.resolution,
        durationSeconds: data.durationSeconds,
      });
      taskId = started.taskId;
      model = started.model;
      modelVersion = null;

      await supabase
        .from("video_generations")
        .update({
          task_id: taskId,
          api_model: model,
          api_model_version: modelVersion,
           options: {
             ...data.options,
             selectedProvider: provider,
             fallbackUsed: false,
           },
        })
        .eq("id", videoId);

      return { videoGenerationId: videoId, status: "running" as const, recoveryNotice: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const { formatVideoError } = await import("@/lib/video-errors");
      const friendly = formatVideoError(message);
      await supabase
        .from("video_generations")
        .update({
          status: "error",
          error_message: friendly.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoId);
      throw new Error(friendly);
    }
  });

const pollSchema = z.object({ videoGenerationId: z.string().uuid() });

export const pollVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => pollSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("video_generations")
      .select("id, tenant_id, status, task_id, duration_seconds, error_message, moderation_status")
      .eq("id", data.videoGenerationId)
      .maybeSingle();
    if (!row) throw new Error("VIDEO_NOT_FOUND");
    if (row.status === "done" || row.status === "error") {
      return { status: row.status as "done" | "error", error: row.error_message };
    }
    if (!row.task_id) return { status: "running" as const, error: null };

    const { getVideoTask } = await import("@/lib/video.server");
    let state: VideoTaskState;
    try {
      if (row.task_id.startsWith("replicate:") || row.task_id.startsWith("lovable:")) {
        throw new Error("LEGACY_VIDEO_PROVIDER_UNSUPPORTED: Start a new Seedance 2.0 generation.");
      }
      state = await getVideoTask(row.task_id);
    } catch (pollError) {
      const reason = pollError instanceof Error ? pollError.message : String(pollError);
      state = { status: "failed", error: reason };
    }

    if (state.status === "queued" || state.status === "running") {
      return { status: "running" as const, error: null, recoveryNotice: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (state.status !== "succeeded" || !state.videoUrl) {
      const message = state.error ?? `VIDEO_TASK_${state.status.toUpperCase()}`;
      const { formatVideoError } = await import("@/lib/video-errors");
      const friendly = formatVideoError(message);
      await supabaseAdmin
        .from("video_generations")
        .update({
          status: "error",
          error_message: friendly.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return { status: "error" as const, error: friendly, recoveryNotice: null };
    }

    try {
      const res = await fetch(state.videoUrl);
      if (!res.ok) throw new Error(`FETCH_VIDEO_FAILED: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const { readMp4Metadata } = await import("@/lib/mp4-metadata.server");
      const metadata = readMp4Metadata(bytes);
      const storagePath = `${row.tenant_id}/video/${row.id}/0.mp4`;

      const { error: upErr } = await supabaseAdmin.storage
        .from("generation-outputs")
        .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
      if (upErr) throw new Error(`STORAGE_UPLOAD_FAILED: ${upErr.message}`);

      await supabaseAdmin.from("video_results").insert({
        video_generation_id: row.id,
        seq: 0,
        storage_path: storagePath,
        source_url: null,
        duration_seconds: metadata.durationSeconds,
        width: metadata.width,
        height: metadata.height,
        moderation_status: row.moderation_status === "approved" ? "approved" : "failed",
        metadata: { measured: true, requestedDurationSeconds: row.duration_seconds },
      });

      await supabaseAdmin
        .from("video_generations")
        .update({
          status: "done",
          actual_resolution: metadata.resolution,
          actual_duration_seconds: metadata.durationSeconds,
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      void userId;
      return { status: "done" as const, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const { formatVideoError } = await import("@/lib/video-errors");
      const friendly = formatVideoError(message);
      await supabaseAdmin
        .from("video_generations")
        .update({
          status: "error",
          error_message: friendly.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return { status: "error" as const, error: friendly };
    }
  });
