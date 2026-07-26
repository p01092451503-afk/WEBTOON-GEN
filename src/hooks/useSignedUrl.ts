import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSignedUrl(bucket: string, path: string | null | undefined, ttl = 300) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttl)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path, ttl]);

  return url;
}
