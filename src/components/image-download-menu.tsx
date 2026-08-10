import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Format = "original" | "png" | "jpeg" | "webp";

const FORMATS: { key: Format; label: string; ext: string }[] = [
  { key: "original", label: "Original (PNG)", ext: "png" },
  { key: "png", label: "PNG", ext: "png" },
  { key: "jpeg", label: "JPG", ext: "jpg" },
  { key: "webp", label: "WEBP", ext: "webp" },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function convert(blob: Blob, format: Exclude<Format, "original">): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNSUPPORTED");
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const mime = `image/${format}`;
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, format === "png" ? undefined : 0.95),
  );
  if (!out) throw new Error("CONVERT_FAILED");
  return out;
}

export function ImageDownloadMenu({
  bucket,
  path,
  baseName,
  className,
  buttonClassName,
  variant = "outline",
  size = "sm",
  compact = false,
}: {
  bucket: string;
  path: string | null | undefined;
  baseName: string;
  className?: string;
  buttonClassName?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "icon";
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handle(format: Format, ext: string) {
    if (!path) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "SIGNED_URL_FAILED");
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error(`FETCH_FAILED_${res.status}`);
      const source = await res.blob();
      const blob = format === "original" ? source : await convert(source, format);
      const safe = baseName.replace(/[^\w.-]+/g, "_").slice(0, 60) || "image";
      triggerDownload(blob, `${safe}.${ext}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!path || busy}>
          <Button
            type="button"
            variant={variant}
            size={size === "icon" ? "icon" : "sm"}
            className={cn("rounded-full", buttonClassName)}
            aria-label={t("download.button")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {!compact && size !== "icon" && <span className="ml-1.5">{t("download.button")}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs">{t("download.format")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {FORMATS.map((f) => (
            <DropdownMenuItem key={f.key} onSelect={() => void handle(f.key, f.ext)}>
              {f.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
