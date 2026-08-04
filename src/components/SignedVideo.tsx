import { useSignedUrl } from "@/hooks/useSignedUrl";
import { cn } from "@/lib/utils";

export function SignedVideo({
  bucket,
  path,
  posterPath,
  className,
  ttl = 300,
  controls = true,
}: {
  bucket: string;
  path: string | null | undefined;
  posterPath?: string | null;
  className?: string;
  ttl?: number;
  controls?: boolean;
}) {
  const url = useSignedUrl(bucket, path, ttl);
  const poster = useSignedUrl(bucket, posterPath ?? null, ttl);

  if (!url) {
    return (
      <div
        className={cn(
          "flex animate-pulse items-center justify-center bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        …
      </div>
    );
  }

  return (
    <video
      src={url}
      poster={poster ?? undefined}
      className={className}
      controls={controls}
      playsInline
      preload="metadata"
    />
  );
}
