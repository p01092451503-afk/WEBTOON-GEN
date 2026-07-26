import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Wrap an icon-only interactive element with an accessible tooltip.
 * Also injects `aria-label` on the child so screen readers announce it.
 */
export function IconTooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement<any>;
}) {
  const existing = (children.props ?? {}) as { "aria-label"?: string; title?: string };
  const child = React.cloneElement(children, {
    "aria-label": existing["aria-label"] ?? label,
    title: existing.title ?? label,
  } as any);
  return (
    <Tooltip>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
