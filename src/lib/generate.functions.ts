import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizePrompt, checkFigureN, checkActionMissing } from "@/lib/promptEngine";

const inputSchema = z.object({
  workLabel: z.string().default("W1"),
  mode: z.enum(["new", "edit"]).default("new"),
  aspectRatio: z.string().optional(),
  finalPrompt: z.string().min(1),
  compiledPrompt: z.string().optional(),
  imagePaths: z.array(z.string()).default([]),
  figureMap: z.array(z.any()).default([]),
  options: z.record(z.any()).default({}),
  batchCount: z.number().int().min(1).max(4).default(1),
  editImagePath: z.string().optional(),
  seed: z.number().int().nullable().optional(),
});

export const generate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) tenant 확인
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (profErr || !profile?.tenant_id) {
      throw new Error("UNAUTHORIZED_NO_TENANT");
    }
    const tenantId = profile.tenant_id;

    // 2) 프롬프트 정리 및 가드
    const cleanPrompt = sanitizePrompt(data.finalPrompt);
    if (checkFigureN(cleanPrompt)) {
      throw new Error("FIGURE_N_NOT_REPLACED");
    }
    const actionText = (data.options as Record<string, unknown>).actionText;
    if (typeof actionText === "string" && checkActionMissing(cleanPrompt, actionText)) {
      throw new Error("ACTION_TEXT_MISSING");
    }

    // 3) generations row 생성
    const { aspectRatioToSize, callArk, makeThumbnailWebp } = await import("@/lib/generate.server");
    const size = aspectRatioToSize(data.aspectRatio);
    const seed = data.seed ?? Math.floor(Math.random() * 2_000_000_000);
    const apiModel = process.env.ARK_ENDPOINT_ID ?? "unknown";

    const { data: genRow, error: genErr } = await supabase
      .from("generations")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        work_label: data.workLabel,
        status: "running",
        mode: data.mode,
        aspect_ratio: data.aspectRatio ?? null,
        api_size: size,
        api_model: apiModel,
        seed,
        compiled_prompt: data.compiledPrompt ?? null,
        final_prompt: cleanPrompt,
        options: data.options,
        figure_map: data.figureMap,
        batch_count: data.batchCount,
      })
      .select("id")
      .single();
    if (genErr || !genRow) throw new Error(`DB_INSERT_GENERATION_FAILED: ${genErr?.message ?? ""}`);
    const generationId = genRow.id as string;

    try {
      // 4) character-refs 서명 URL 발급 (ARK가 fetch 가능한 공인 URL)
      const inputPaths = [...data.imagePaths];
      if (data.mode === "edit" && data.editImagePath) inputPaths.unshift(data.editImagePath);

      const imageUrls: string[] = [];
      for (const p of inputPaths) {
        const { data: signed, error: sErr } = await supabase.storage
          .from("character-refs")
          .createSignedUrl(p, 300);
        if (sErr || !signed?.signedUrl) {
          throw new Error(`SIGNED_URL_FAILED: ${p} ${sErr?.message ?? ""}`);
        }
        imageUrls.push(signed.signedUrl);
      }

      // 5) ARK 호출
      const arkResults = await callArk({
        prompt: cleanPrompt,
        imageUrls,
        size,
        seed,
        batchCount: data.batchCount,
      });

      // 7) 결과 이미지 저장
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const savedResults: Array<{
        seq: number;
        storage_path: string;
        thumb_path: string | null;
        source_url: string;
        width?: number;
        height?: number;
      }> = [];

      for (let i = 0; i < arkResults.length; i++) {
        const r = arkResults[i];
        const imgRes = await fetch(r.url);
        if (!imgRes.ok) throw new Error(`FETCH_RESULT_FAILED: ${imgRes.status}`);
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const contentType = imgRes.headers.get("content-type") ?? "image/png";
        const ext = contentType.includes("jpeg") ? "jpg" : "png";
        const storagePath = `${tenantId}/${generationId}/${i}.${ext}`;

        const { error: upErr } = await supabaseAdmin.storage
          .from("generation-outputs")
          .upload(storagePath, bytes, { contentType, upsert: true });
        if (upErr) throw new Error(`STORAGE_UPLOAD_FAILED: ${upErr.message}`);

        // 썸네일 (실패해도 원본 저장은 유지)
        let thumbPath: string | null = null;
        try {
          const thumbBytes = await makeThumbnailWebp(bytes);
          thumbPath = `${tenantId}/${generationId}/${i}_thumb.webp`;
          const { error: tErr } = await supabaseAdmin.storage
            .from("generation-outputs")
            .upload(thumbPath, thumbBytes, { contentType: "image/webp", upsert: true });
          if (tErr) {
            console.warn("THUMB_UPLOAD_FAILED", tErr.message);
            thumbPath = null;
          }
        } catch (e) {
          console.warn("THUMB_MAKE_FAILED", e instanceof Error ? e.message : String(e));
        }

        savedResults.push({
          seq: i,
          storage_path: storagePath,
          thumb_path: thumbPath,
          source_url: r.url,
          width: r.width,
          height: r.height,
        });
      }

      // 8) generation_results / usage_events / generations 업데이트
      if (savedResults.length > 0) {
        const { error: resErr } = await supabaseAdmin.from("generation_results").insert(
          savedResults.map((s) => ({
            generation_id: generationId,
            seq: s.seq,
            storage_path: s.storage_path,
            thumb_path: s.thumb_path,
            source_url: s.source_url,
            source_url_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            width: s.width ?? null,
            height: s.height ?? null,
          })),
        );
        if (resErr) throw new Error(`DB_INSERT_RESULTS_FAILED: ${resErr.message}`);
      }

      await supabaseAdmin.from("usage_events").insert({
        tenant_id: tenantId,
        user_id: userId,
        generation_id: generationId,
        image_count: savedResults.length,
        est_api_cost: savedResults.length * 0.03,
      });

      await supabaseAdmin
        .from("generations")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", generationId);

      return { generationId, status: "done" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 시크릿이 로그/응답에 흘러가지 않도록 message 만 저장
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("generations")
        .update({ status: "error", error_message: message.slice(0, 1000), completed_at: new Date().toISOString() })
        .eq("id", generationId);
      throw new Error(message);
    }
  });
