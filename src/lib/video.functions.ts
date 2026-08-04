import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startSchema = z.object({
  workLabel: z.string().default("V1"),
  /** 영상 생성 프로바이더. auto = Seedance 우선, 실패 시 Lovable AI Gateway 폴백 */
  provider: z.enum(["auto", "seedance", "lovable"]).default("auto"),
  mode: z.enum(["t2v", "i2v"]).default("t2v"),

  finalPrompt: z.string().min(1).max(4000),
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
    if (!prompt) throw new Error("EMPTY_PROMPT");

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
        raw_prompt: data.rawPrompt ?? null,
        prompt_edited: data.promptEdited,
        aspect_ratio: data.aspectRatio,
        resolution: data.resolution,
        duration_seconds: data.durationSeconds,
        camera_fixed: data.cameraFixed,
        seed,
        image_paths: data.imagePaths,
        options: data.options,
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

      const runSeedance = async () => {
        const { buildSeedanceText, createVideoTask } = await import("@/lib/video.server");
        const text = buildSeedanceText({
          prompt,
          aspectRatio: data.aspectRatio,
          resolution: data.resolution,
          durationSeconds: data.durationSeconds,
          cameraFixed: data.cameraFixed,
          seed,
          hasFirstFrame: signedUrls.length > 0,
        });
        return createVideoTask({
          text,
          firstFrameUrl: signedUrls[0] ?? null,
          lastFrameUrl: signedUrls[1] ?? null,
        });
      };

      const runLovable = async () => {
        const { buildLovableVideoPrompt, createLovableVideoTask } = await import(
          "@/lib/video-lovable.server"
        );
        return createLovableVideoTask({
          prompt: buildLovableVideoPrompt({ prompt, cameraFixed: data.cameraFixed, seed }),
          aspectRatio: data.aspectRatio,
          durationSeconds: data.durationSeconds,
          firstFrameUrl: signedUrls[0] ?? null,
        });
      };

      // 프로바이더 선택: seedance(기존) / lovable(AI Gateway) / auto(Seedance 실패 시 폴백)
      let taskId: string;
      let model: string;
      if (data.provider === "lovable") {
        ({ taskId, model } = await runLovable());
      } else if (data.provider === "seedance") {
        ({ taskId, model } = await runSeedance());
      } else {
        try {
          ({ taskId, model } = await runSeedance());
        } catch (seedanceErr) {
          const seedanceMessage =
            seedanceErr instanceof Error ? seedanceErr.message : String(seedanceErr);
          try {
            ({ taskId, model } = await runLovable());
          } catch (lovableErr) {
            const lovableMessage =
              lovableErr instanceof Error ? lovableErr.message : String(lovableErr);
            throw new Error(`${seedanceMessage} || FALLBACK_LOVABLE: ${lovableMessage}`);
          }
        }
      }

      await supabase
        .from("video_generations")
        .update({ task_id: taskId, api_model: model })
        .eq("id", videoId);


      return { videoGenerationId: videoId, status: "running" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("video_generations")
        .update({
          status: "error",
          error_message: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoId);
      throw new Error(message);
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
      .select("id, tenant_id, status, task_id, duration_seconds, error_message")
      .eq("id", data.videoGenerationId)
      .maybeSingle();
    if (!row) throw new Error("VIDEO_NOT_FOUND");
    if (row.status === "done" || row.status === "error") {
      return { status: row.status as "done" | "error", error: row.error_message };
    }
    if (!row.task_id) return { status: "running" as const, error: null };

    const { isLovableTaskId, getLovableVideoTask } = await import("@/lib/video-lovable.server");
    const { getVideoTask } = await import("@/lib/video.server");
    const state = isLovableTaskId(row.task_id)
      ? await getLovableVideoTask(row.task_id)
      : await getVideoTask(row.task_id);


    if (state.status === "queued" || state.status === "running") {
      return { status: "running" as const, error: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (state.status !== "succeeded" || !state.videoUrl) {
      const message = state.error ?? `VIDEO_TASK_${state.status.toUpperCase()}`;
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

    try {
      const res = await fetch(state.videoUrl);
      if (!res.ok) throw new Error(`FETCH_VIDEO_FAILED: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const storagePath = `${row.tenant_id}/video/${row.id}/0.mp4`;

      const { error: upErr } = await supabaseAdmin.storage
        .from("generation-outputs")
        .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
      if (upErr) throw new Error(`STORAGE_UPLOAD_FAILED: ${upErr.message}`);

      await supabaseAdmin.from("video_results").insert({
        video_generation_id: row.id,
        seq: 0,
        storage_path: storagePath,
        source_url: state.videoUrl,
        duration_seconds: row.duration_seconds,
      });

      await supabaseAdmin
        .from("video_generations")
        .update({ status: "done", completed_at: new Date().toISOString() })
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
