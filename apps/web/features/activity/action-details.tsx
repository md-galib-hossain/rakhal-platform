import { Chip } from "@/components/ui/chip";

/**
 * `actionDetails` strings wrap "chip-worthy" tokens in `[brackets]` — the real convention every
 * module already writes (`cattle.service.ts`: `` `New [${cattle.purpose}] [${cattle.name}] registered.` ``,
 * `health.service.ts`, `milk.service.ts`, `aqr.service.ts`, …), not a frontend invention. This
 * splits on that convention and renders bracketed tokens as `Chip`s, matching the Figma "Action
 * Details" line (734:51037 etc) where the same values render as pill chips inline with plain text.
 */
export function ActionDetails({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <span aria-hidden>&ldquo;</span>
      {parts.map((part, i) => {
        const match = /^\[([^\]]+)\]$/.exec(part);
        if (match) {
          return (
            <Chip key={i} variant="muted" className="px-3 py-1">
              {match[1]}
            </Chip>
          );
        }
        return (
          <span key={i} className="text-foreground/80">
            {part}
          </span>
        );
      })}
      <span aria-hidden>&rdquo;</span>
    </p>
  );
}
