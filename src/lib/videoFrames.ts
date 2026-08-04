/** Browser-only helpers: sample still frames from a locally selected video file. */

export async function extractVideoFrames(file: File, count = 3): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video file."));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const width = Math.min(video.videoWidth || 640, 768);
    const scale = width / (video.videoWidth || width);
    const height = Math.round((video.videoHeight || 360) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");

    const blobs: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const time = (duration * (i + 0.5)) / count;
      await seek(video, Math.min(time, Math.max(duration - 0.05, 0)));
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      if (blob) blobs.push(blob);
    }
    return blobs;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.onerror = () => reject(new Error("Could not decode this video file."));
    video.currentTime = time;
  });
}
