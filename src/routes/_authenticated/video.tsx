import { createFileRoute } from "@tanstack/react-router";
import { VideoPlaygroundPage } from "@/video-playground-page";

export const Route = createFileRoute("/_authenticated/video")({
  component: VideoPlaygroundPage,
  head: () => ({
    meta: [
      { title: "Video Playground · pilotstudio" },
      {
        name: "description",
        content: "Create high-quality AI videos from a prompt with optional image and video references.",
      },
      { property: "og:title", content: "Video Playground · pilotstudio" },
      {
        property: "og:description",
        content: "Add reference media, describe the video, and let pilotstudio prepare the generation settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});