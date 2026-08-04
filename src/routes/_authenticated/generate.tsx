import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/generate")({
  beforeLoad: () => {
    throw redirect({ to: "/video", replace: true });
  },
  component: () => null,
  head: () => ({ meta: [{ title: "Video Studio · pilotstudio" }] }),
});
