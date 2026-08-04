import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VideoTaskState } from "@/lib/video.server";

const startSchema = z.object({
  workLabel: z.string().default("V1"),
  /** 영상 생성 프로바이더. 현재 사용 가능한 기본 엔진은 Replicate다. */
  provider: z.enum(["auto", "seedance", "lovable", "replicate"]).default("replicate"),
  mode: z.enum(["t2v", "i2v"]).default("t2v"),

  finalPrompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional(),
  rawPrompt: z.string().max(4000).optional(),
  promptEdited: z.boolean().default(false),
  aspectRatio: z.string().default("16:9"),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  durationSeconds: z.number().int().min(3).max(12).default(5),
  cameraFixed: z.boolean().default(false),
  seed: z.number().int().nullable().optional(),
  /** character-refs 버킷의 storage path. [0]=first frame, [1]=last frame */
  imagePaths: z.array(z.string()).max(2).default([]),
  options: z.record(z.any()).default({}),
});

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startSchema.parse(data))
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
    if (/(^|\s)@[A-Za-z0-9_-]+/.test(prompt)) throw new Error("UNRESOLVED_MEDIA_MENTION");

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

      // Veo is not currently exposed by Lovable AI Gateway. Keep accepting the
      // legacy value so an already-open browser cannot trigger a known 400.
      const provider =
        data.provider === "auto" || data.provider === "lovable" ? "replicate" : data.provider;
      const providerInput = {
        prompt,
        negativePrompt,
        aspectRatio: data.aspectRatio,
        resolution: data.resolution,
        durationSeconds: data.durationSeconds,
        firstFrameUrl: signedUrls[0] ?? null,
        lastFrameUrl: signedUrls[1] ?? null,
        cameraFixed: data.cameraFixed,
        seed,
      };
      const { recoveryAttempt } = await import("@/lib/video-recovery.server");
      let taskId: string;
      let model: string;
      let modelVersion: string | null;
      let recoveryAttempts: Array<Record<string, string>> = [];
      let recoveryNotice: string | null = null;

      console.info("[video-generation-dispatch]", {
        videoGenerationId: videoId,
        provider,
        mode: data.mode,
        prompt,
        negative_prompt: negativePrompt,
      });

      if (provider === "seedance") {
         const { buildSeedanceText, createVideoTask } = await import("@/lib/video.server");
         const started = await createVideoTask({
           text: buildSeedanceText({
             prompt,
             aspectRatio: data.aspectRatio,
             resolution: data.resolution,
             durationSeconds: data.durationSeconds,
             cameraFixed: data.cameraFixed,
             seed,
             hasFirstFrame: Boolean(signedUrls[0]),
           }),
           firstFrameUrl: signedUrls[0] ?? null,
           lastFrameUrl: signedUrls[1] ?? null,
         });
         taskId = started.taskId;
         model = started.model;
         modelVersion = null;
      } else try {
         const { createReplicateWithRetry, recoveryAttempt } = await import(
           "@/lib/video-recovery.server"
         );
         const started = await createReplicateWithRetry(providerInput);
         taskId = started.task.taskId;
         model = started.task.model;
         modelVersion = started.task.modelVersion;
         recoveryAttempts = started.attempts;
         if (started.attempts.length > 0) {
           recoveryNotice = "A temporary provider error occurred, but the automatic retry succeeded.";
         }
       } catch (primaryError) {
        const primaryReason = primaryError instanceof Error ? primaryError.message : String(primaryError);
        const priorAttempts =
          primaryError && typeof primaryError === "object" && "recoveryAttempts" in primaryError
            ? (primaryError.recoveryAttempts as Array<Record<string, string>>)
            : [recoveryAttempt("replicate", "start", "failed", primaryReason)];
        recoveryAttempts = priorAttempts;

        try {
          const { buildSeedanceText, createVideoTask } = await import("@/lib/video.server");
          const fallback = await createVideoTask({
            text: buildSeedanceText({
              prompt,
              aspectRatio: data.aspectRatio,
              resolution: data.resolution,
              durationSeconds: data.durationSeconds,
              cameraFixed: data.cameraFixed,
              seed,
              hasFirstFrame: Boolean(signedUrls[0]),
            }),
            firstFrameUrl: signedUrls[0] ?? null,
            lastFrameUrl: signedUrls[1] ?? null,
          });
          taskId = fallback.taskId;
          model = fallback.model;
          modelVersion = null;
          recoveryAttempts.push(
            recoveryAttempt("seedance", "fallback", "started", "Replicate start failed"),
          );
          recoveryNotice =
            "Replicate could not start the job, so generation automatically switched to Seedance.";
        } catch (fallbackError) {
          const fallbackReason =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(`${primaryReason} || FALLBACK_FAILED: ${fallbackReason}`);
        }
      };

      await supabase
        .from("video_generations")
        .update({
          task_id: taskId,
          api_model: model,
          api_model_version: modelVersion,
           options: {
             ...data.options,
             selectedProvider: provider,
             recoveryAttempts,
             fallbackUsed: provider === "replicate" && modelVersion === null,
           },
        })
        .eq("id", videoId);

      return { videoGenerationId: videoId, status: "running" as const, recoveryNotice };
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
  .inputValidator((data: unknown) => pollSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("video_generations")
      .select("id, tenant_id, status, task_id, duration_seconds, error_message, moderation_status, final_prompt, negative_prompt, aspect_ratio, resolution, camera_fixed, seed, image_paths, options")
      .eq("id", data.videoGenerationId)
      .maybeSingle();
    if (!row) throw new Error("VIDEO_NOT_FOUND");
    if (row.status === "done" || row.status === "error") {
      return { status: row.status as "done" | "error", error: row.error_message };
    }
    if (!row.task_id) return { status: "running" as const, error: null };

    const { isLovableTaskId, getLovableVideoTask } = await import("@/lib/video-lovable.server");
    const { isReplicateTaskId, getReplicateVideoTask } =
      await import("@/lib/video-replicate.server");
    const { createVideoTask, getVideoTask } = await import("@/lib/video.server");
    const options =
      row.options && typeof row.options === "object" && !Array.isArray(row.options)
        ? (row.options as Record<string, unknown>)
        : {};
    const {
      isRetryableVideoError,
      readRecoveryAttempts,
      recoveryAttempt,
      recoveryMessage,
    } = await import("@/lib/video-recovery.server");
    const recoveryAttempts = readRecoveryAttempts(options);
    let state: VideoTaskState;
    try {
      if (isReplicateTaskId(row.task_id)) {
        state = await getReplicateVideoTask(row.task_id);
      } else if (isLovableTaskId(row.task_id)) {
        state = await getLovableVideoTask(row.task_id);
      } else {
        state = await getVideoTask(row.task_id);
      }
    } catch (pollError) {
      const reason = pollError instanceof Error ? pollError.message : String(pollError);
      const pollRetries = recoveryAttempts.filter(
        (item) => item.provider === "replicate" && item.stage === "poll",
      ).length;
      if (isReplicateTaskId(row.task_id) && isRetryableVideoError(pollError) && pollRetries < 2) {
        recoveryAttempts.push(recoveryAttempt("replicate", "poll", "retrying", reason));
        await supabase
          .from("video_generations")
          .update({ options: { ...options, recoveryAttempts } })
          .eq("id", row.id);
        return {
          status: "running" as const,
          error: null,
          recoveryNotice: "The provider is temporarily unavailable. Retrying automatically…",
        };
      }
      state = { status: "failed", error: reason };
    }

    if (state.status === "queued" || state.status === "running") {
      return { status: "running" as const, error: null, recoveryNotice: recoveryMessage(recoveryAttempts) };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (state.status !== "succeeded" || !state.videoUrl) {
      const message = state.error ?? `VIDEO_TASK_${state.status.toUpperCase()}`;
      const fallbackAlreadyUsed = options.fallbackUsed === true || !isReplicateTaskId(row.task_id);
      if (!fallbackAlreadyUsed) {
        try {
          const imagePaths = Array.isArray(row.image_paths)
            ? row.image_paths.filter((path): path is string => typeof path === "string")
            : [];
          const signedUrls: string[] = [];
          for (const path of imagePaths) {
            const { data: signed, error: signedError } = await supabase.storage
              .from("character-refs")
              .createSignedUrl(path, 3600);
            if (signedError || !signed?.signedUrl) throw new Error(`SIGNED_URL_FAILED: ${path}`);
            signedUrls.push(signed.signedUrl);
          }
          const fallback = await createVideoTask({
            text: (await import("@/lib/video.server")).buildSeedanceText({
              prompt: row.final_prompt,
              aspectRatio: row.aspect_ratio,
              resolution: row.resolution,
              durationSeconds: row.duration_seconds,
              cameraFixed: row.camera_fixed,
              seed: row.seed,
              hasFirstFrame: Boolean(signedUrls[0]),
            }),
            firstFrameUrl: signedUrls[0] ?? null,
            lastFrameUrl: signedUrls[1] ?? null,
          });
          recoveryAttempts.push(recoveryAttempt("replicate", "poll", "failed", message));
          recoveryAttempts.push(
            recoveryAttempt("seedance", "fallback", "started", "Primary task failed"),
          );
          await supabaseAdmin
            .from("video_generations")
            .update({
              task_id: fallback.taskId,
              api_model: fallback.model,
              api_model_version: null,
              error_message: null,
              options: { ...options, fallbackUsed: true, recoveryAttempts },
            })
            .eq("id", row.id);
          return {
            status: "running" as const,
            error: null,
            recoveryNotice:
              "The primary pipeline failed. Generation automatically switched to Seedance.",
          };
        } catch (fallbackError) {
          const fallbackReason =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          const combined = `${message} || FALLBACK_FAILED: ${fallbackReason}`;
          const { formatVideoError } = await import("@/lib/video-errors");
          const friendly = formatVideoError(combined);
          recoveryAttempts.push(recoveryAttempt("replicate", "poll", "failed", message));
          recoveryAttempts.push(recoveryAttempt("seedance", "fallback", "failed", fallbackReason));
          await supabaseAdmin
            .from("video_generations")
            .update({
              status: "error",
              error_message: friendly.slice(0, 1000),
              options: { ...options, fallbackUsed: true, recoveryAttempts },
              completed_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          return { status: "error" as const, error: friendly, recoveryNotice: null };
        }
      }
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
      await supabaseAdmin
        .from("video_generations")
        .update({
          status: "error",
          error_message: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return { status: "error" as const, error: message };
    }
  });
