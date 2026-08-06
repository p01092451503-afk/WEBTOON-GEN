import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/video")({
  beforeLoad: () => {
    throw redirect({ to: "/generate", replace: true });
  },
  component: () => null,
  head: () => ({ meta: [{ title: "Image Studio · pilottoon" }] }),
});
