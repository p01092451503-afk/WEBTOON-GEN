import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ title: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: prof, error: pErr } = await context.supabase
      .from("profiles").select("tenant_id").eq("id", context.userId).single();
    if (pErr || !prof) throw new Error(pErr?.message ?? "no profile");
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({ title: data.title, tenant_id: prof.tenant_id, created_by: context.userId })
      .select("id, title, created_at").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: project, error: pErr }, { data: episodes, error: eErr }, { data: cast, error: cErr }] = await Promise.all([
      context.supabase.from("projects").select("id, title, created_at").eq("id", data.id).single(),
      context.supabase.from("episodes").select("id, title, order_index, created_at").eq("project_id", data.id).order("order_index"),
      context.supabase.from("project_cast").select("character_id, role_label, characters(id, display_name)").eq("project_id", data.id),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (eErr) throw new Error(eErr.message);
    if (cErr) throw new Error(cErr.message);
    return { project, episodes: episodes ?? [], cast: cast ?? [] };
  });

export const createEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), title: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: last } = await context.supabase
      .from("episodes").select("order_index").eq("project_id", data.project_id)
      .order("order_index", { ascending: false }).limit(1).maybeSingle();
    const nextIdx = (last?.order_index ?? -1) + 1;
    const { data: row, error } = await context.supabase
      .from("episodes")
      .insert({ project_id: data.project_id, title: data.title, order_index: nextIdx })
      .select("id, title, order_index, created_at").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("episodes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addCastMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    project_id: z.string().uuid(),
    character_id: z.string().uuid(),
    role_label: z.string().max(100).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_cast")
      .insert({ project_id: data.project_id, character_id: data.character_id, role_label: data.role_label ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCastMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), character_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_cast").delete()
      .eq("project_id", data.project_id).eq("character_id", data.character_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEpisode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: episode, error: eErr } = await context.supabase
      .from("episodes").select("id, title, order_index, project_id, projects(id, title)").eq("id", data.id).single();
    if (eErr) throw new Error(eErr.message);
    const { data: panels, error: pErr } = await context.supabase
      .from("panels")
      .select("id, order_index, caption, status, generation_id, chosen_result_id")
      .eq("episode_id", data.id).order("order_index");
    if (pErr) throw new Error(pErr.message);
    return { episode, panels: panels ?? [] };
  });

export const createPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ episode_id: z.string().uuid(), caption: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: last } = await context.supabase
      .from("panels").select("order_index").eq("episode_id", data.episode_id)
      .order("order_index", { ascending: false }).limit(1).maybeSingle();
    const nextIdx = (last?.order_index ?? -1) + 1;
    const { data: row, error } = await context.supabase
      .from("panels")
      .insert({ episode_id: data.episode_id, order_index: nextIdx, caption: data.caption ?? null })
      .select("id, order_index, caption, status").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("panels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
