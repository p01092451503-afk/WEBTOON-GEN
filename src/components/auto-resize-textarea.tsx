import * as React from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = React.ComponentProps<typeof Textarea> & {
  /** 최소 높이(px) */
  minHeight?: number;
  /** 최대 높이(px) — 넘으면 내부 스크롤 */
  maxHeight?: number;
};

/**
 * 입력하는 대로 높이가 자동으로 늘어나는 textarea.
 * 사용자가 모서리를 드래그해 직접 넓힐 수도 있다(resize-y).
 */
export function AutoResizeTextarea({
  minHeight = 88,
  maxHeight = 400,
  className = "",
  value,
  onChange,
  ...rest
}: Props) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const [manual, setManual] = React.useState(false);

  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el || manual) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [manual, minHeight, maxHeight]);

  React.useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      // 사용자가 직접 크기를 조절하면 자동 높이 조절을 멈춘다.
      onMouseUp={() => {
        const el = ref.current;
        if (el && el.style.height && parseInt(el.style.height, 10) !== el.offsetHeight) {
          setManual(true);
        }
      }}
      style={{ minHeight }}
      className={`resize-y ${className}`}
      {...rest}
    />
  );
}
