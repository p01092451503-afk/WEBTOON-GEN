import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias: the character library is now "이미지 그룹" at /groups.
export const Route = createFileRoute("/_authenticated/characters")({
  beforeLoad: () => {
    throw redirect({ to: "/groups", replace: true });
  },
});
