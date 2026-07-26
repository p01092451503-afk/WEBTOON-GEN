import { useSignedUrl } from "@/hooks/useSignedUrl";
import { cn } from "@/lib/utils";

export function SignedImage({
  bucket,
  path,
  alt,
  className,
  ttl = 300,
}: {
  bucket: string;
  path: string | null | undefined;
  alt: string;
  className?: string;
  ttl?: number;
}) {
  const url = useSignedUrl(bucket, path, ttl);
  if (!url) {
    return (
      <div
        className={cn(
          "bg-muted animate-pulse flex items-center justify-center text-xs text-muted-foreground",
          className,
        )}
      >
        …
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
