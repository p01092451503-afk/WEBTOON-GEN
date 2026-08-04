import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SignedImage } from "@/components/SignedImage";

export type MentionItem = {
  /** token name without the @ */
  name: string;
  /** storage path in the character-refs bucket used for the thumbnail */
  coverPath: string;
  /** short helper line shown next to the name */
  hint?: string;
};

/**
 * Prompt textarea with "@" mentions, like Dreamina / Playground.
 * Typing "@" opens a picker of the uploaded reference media; picking one
 * inserts an "@name" token into the prompt at the caret.
 */
export function MentionTextarea({
  value,
  onChange,
  items,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  items: MentionItem[];
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState(0); // index of the "@"

  const matches = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  function syncMentionState(text: string, caret: number) {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) return setOpen(false);
    const between = before.slice(at + 1);
    // a mention token is a single word right after "@"
    if (/[\s@]/.test(between)) return setOpen(false);
    const charBefore = at === 0 ? "" : before[at - 1];
    if (charBefore && !/\s/.test(charBefore)) return setOpen(false);
    setAnchor(at);
    setQuery(between);
    setOpen(items.length > 0);
  }

  function insert(name: string) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, anchor)}@${name} ${value.slice(caret)}`;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      const pos = anchor + name.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          syncMentionState(e.target.value, e.target.selectionStart ?? 0);
        }}
        onClick={(e) => syncMentionState(value, e.currentTarget.selectionStart ?? 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insert(matches[active].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Reference media
          </p>
          <ul className="max-h-56 overflow-y-auto p-1">
            {matches.map((m, i) => (
              <li key={m.name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => insert(m.name)}
                  className={
                    "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left " +
                    (i === active ? "bg-muted" : "")
                  }
                >
                  <SignedImage
                    bucket="character-refs"
                    path={m.coverPath}
                    alt={m.name}
                    className="h-8 w-10 shrink-0 rounded-md object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">@{m.name}</span>
                    {m.hint && (
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {m.hint}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
