"use client"; // measures the rendered element on hover/focus to decide whether a tooltip is needed

import { useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../../lib/utils";

export interface TruncatedTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** Visible lines before the ellipsis. Default 1. */
  lines?: number;
  /** Tooltip body when it should differ from the text itself (default: the element's own text). */
  tooltip?: React.ReactNode;
}

/** True when the element's content is wider/taller than its box, i.e. the ellipsis is actually showing. */
export function isTextClipped(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

/**
 * Text that gives way to its neighbours: clamps to `lines` with an ellipsis, and shows the full text in a tooltip —
 * but only when it really is cut. With room to spare it renders as plain text and never opens a tooltip.
 * Pair it with `shrink-0` on the values that must stay visible (amounts, status chips).
 */
export function TruncatedText({ children, lines = 1, tooltip, className, ...props }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [fullText, setFullText] = useState<string>("");

  const handleOpenChange = (next: boolean) => {
    const el = ref.current;
    if (!next || !el || !isTextClipped(el)) {
      setOpen(false);
      return;
    }
    setFullText(el.textContent ?? "");
    setOpen(true);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <span
            ref={ref}
            data-truncated-text
            className={cn("min-w-0", lines === 1 ? "block truncate" : "line-clamp-[var(--lines)] break-words", className)}
            style={lines > 1 ? ({ "--lines": lines } as React.CSSProperties) : undefined}
            {...props}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm break-words">{tooltip ?? fullText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
