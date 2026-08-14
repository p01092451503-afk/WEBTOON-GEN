import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queuePendingRefs, type PendingRef } from "./pendingRefs";

const EDIT_RESTORE_KEY = "toonpilot:editRestore";

export async function copyOutputToRefs(
  tenantId: string | null,
  path: string,
): Promise<string | null> {
  if (!tenantId) return null;
  const { data, error } = await supabase.storage.from("generation-outputs").download(path);
  if (error || !data) {
    toast.error(error?.message ?? "download failed");
    return null;
  }
  const ext = path.split(".").pop()?.toLowerCase() || "png";
  const dest = `${tenantId}/refs/out-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("character-refs")
    .upload(dest, data, { contentType: data.type || "image/png" });
  if (upErr) {
    toast.error(upErr.message);
    return null;
  }
  return dest;
}

export function pushReferenceAndGo(path: string, name?: string) {
  const refs: PendingRef[] = [{ path, name: name ?? "history", roles: ["character"] }];
  queuePendingRefs(refs);
  if (typeof window !== "undefined") {
    window.location.href = "/generate";
  }
}

export type EditRestorePayload = {
  path: string;
  options?: any;
  aspectRatio?: string | null;
  prompt?: string | null;
};

export function pushEditAndGo(
  path: string,
  options?: any,
  aspectRatio?: string | null,
  prompt?: string | null,
) {
  const refs: PendingRef[] = [{ path, name: "edit-source", roles: ["character"] }];
  queuePendingRefs(refs);
  const payload: EditRestorePayload = { path, options, aspectRatio, prompt };
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(EDIT_RESTORE_KEY, JSON.stringify(payload));
    window.location.href = "/generate";
  }
}

export function consumeEditRestore(): EditRestorePayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(EDIT_RESTORE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(EDIT_RESTORE_KEY);
  try {
    return JSON.parse(raw) as EditRestorePayload;
  } catch {
    return null;
  }
}
